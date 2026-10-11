'use strict';

// Lovart's documented Agent OpenAPI only. No direct model-provider fallback.
const crypto = require('node:crypto');
const dns = require('node:dns/promises');
const net = require('node:net');
const config = require('./image-generation-models.json');

const RATIOS = ['1:1', '4:5', '16:9', '9:16'];
const MAX_REFERENCE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_REFERENCE_BYTES = 24 * 1024 * 1024;
const MAX_BODY_BYTES = Math.ceil(MAX_TOTAL_REFERENCE_BYTES / 3) * 4 + 256 * 1024;
const MAX_RESULT_BYTES = 20 * 1024 * 1024;
const MAX_REFERENCES = 10;
const ROLES = ['appearance', 'character', 'subject', 'composition', 'style', 'material', 'background'];
const CANCELLATION = Object.freeze({ scope: 'local', upstreamCancellationSupported: false, billingMayContinue: true, message: '已停止本地等待；Lovart未公开撤销接口，平台生成和计费可能继续' });

class ImageGenerationError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
function reject(status, code, message) { throw new ImageGenerationError(status, code, message); }
function plainObject(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function imageInfo(bytes, declaredMime) {
  let mime, width, height;
  if (bytes.length > 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.toString('ascii', 12, 16) === 'IHDR') {
    mime = 'image/png'; width = bytes.readUInt32BE(16); height = bytes.readUInt32BE(20);
  } else if (bytes.length > 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    mime = 'image/jpeg';
    for (let offset = 2; offset + 9 < bytes.length;) {
      if (bytes[offset++] !== 255) break;
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || marker >= 208 && marker <= 215) continue;
      if (offset + 2 > bytes.length) break;
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) && length >= 7) {
        height = bytes.readUInt16BE(offset + 3); width = bytes.readUInt16BE(offset + 5); break;
      }
      offset += length;
    }
  } else if (bytes.length > 16 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
    mime = 'image/webp';
    if (bytes.length >= 30 && bytes.toString('ascii', 12, 16) === 'VP8X') {
      width = 1 + bytes.readUIntLE(24, 3); height = 1 + bytes.readUIntLE(27, 3);
    } else if (bytes.length >= 30 && bytes.toString('ascii', 12, 16) === 'VP8 ' && bytes[23] === 157 && bytes[24] === 1 && bytes[25] === 42) {
      width = bytes.readUInt16LE(26) & 16383; height = bytes.readUInt16LE(28) & 16383;
    } else if (bytes.length >= 25 && bytes.toString('ascii', 12, 16) === 'VP8L' && bytes[20] === 47) {
      const bits = bytes.readUInt32LE(21); width = (bits & 16383) + 1; height = (bits >>> 14 & 16383) + 1;
    }
  }
  if (!mime || declaredMime && mime !== declaredMime) reject(400, 'INVALID_IMAGE', '图片内容与PNG、JPEG或WebP格式不符');
  if (width !== undefined && (!width || !height || width > 32768 || height > 32768 || width * height > 150000000)) reject(400, 'INVALID_DIMENSIONS', '图片尺寸无效或超过150百万像素');
  return { mime, ...(width ? { width, height } : {}) };
}
function signature(method, path, accessKey, secretKey, time = Date.now()) {
  const timestamp = String(Math.floor(time / 1000));
  return { 'X-Access-Key': accessKey, 'X-Timestamp': timestamp, 'X-Signature': crypto.createHmac('sha256', secretKey).update(method + '\n' + path + '\n' + timestamp).digest('hex'), 'X-Signed-Method': method, 'X-Signed-Path': path };
}
function publicAddress(address) {
  if (net.isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return ![0, 10, 127].includes(a) && !(a === 100 && b >= 64 && b <= 127) && !(a === 169 && b === 254) && !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && (b === 0 || b === 168)) && !(a === 198 && [18, 19].includes(b)) && a < 224;
  }
  if (net.isIP(address) === 6) {
    const lower = address.toLowerCase();
    if (lower.startsWith('::ffff:')) return publicAddress(lower.slice(7));
    return !['::', '::1'].includes(lower) && !/^(?:f[cd]|fe[89ab]|ff)/.test(lower);
  }
  return false;
}
async function boundedBytes(response, limit, signal) {
  if (Number(response.headers.get('content-length') || 0) > limit) reject(502, 'UPSTREAM_TOO_LARGE', 'Lovart返回内容超过限制');
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader(), chunks = []; let length = 0;
  try {
    while (true) {
      if (signal?.aborted) throw signal.reason || new Error('请求已取消');
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) { await reader.cancel(); reject(502, 'UPSTREAM_TOO_LARGE', 'Lovart返回内容超过限制'); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks, length);
}
function actualTool(artifact, item) {
  // Do not mistake a preferred/requested model for evidence of the actual tool.
  for (const object of [artifact, artifact?.metadata, item, item?.metadata]) {
    if (!plainObject(object)) continue;
    for (const key of ['tool_name', 'tool', 'model']) if (typeof object[key] === 'string' && object[key].trim()) return object[key].trim().slice(0, 200);
  }
  return null;
}
function modelFamily(tool) {
  if (/^generate_image_gpt_image_2_5_(?:flare|sunburst)(?:_(?:low|medium|high|xhigh|max))?$/.test(tool)) return 'image2.5';
  if (/^generate_image_gpt_image_2(?:_(?:low|medium|high))?$/.test(tool)) return 'image2';
  if (tool === 'generate_image_nano_banana_pro') return 'nano-banana-pro';
  return null;
}

function createImageGenerationService(options = {}) {
  const env = options.env || process.env;
  const fetcher = options.fetch || globalThis.fetch;
  const lookup = options.lookup || dns.lookup;
  const accessKey = String(env.LOVART_ACCESS_KEY || '').trim(), secretKey = String(env.LOVART_SECRET_KEY || '').trim();
  const configured = Boolean(accessKey && secretKey);
  const timeoutMs = options.timeoutMs ?? 8 * 60 * 1000;
  const pollMs = options.pollMs ?? 3000;
  const doneDelayMs = options.doneDelayMs ?? 5000;
  const ttlMs = options.ttlMs ?? 20 * 60 * 1000;
  const maxQueued = options.maxQueued ?? 2;
  const maxRetained = options.maxRetained ?? 8;
  const extraAssetHosts = new Set(String(env.LOVART_ASSET_HOSTS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean));
  const jobs = new Map(), queue = [], generatedHashes = new Set();
  let running = null, closed = false;

  function cleanError(value) {
    let message = String(value || 'Lovart生图未完成');
    for (const secret of [accessKey, secretKey]) if (secret) message = message.split(secret).join('[redacted]');
    return message.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').replace(/((?:access|secret)[_-]?key|(?:access|refresh|id)_token|api[_-]?key|X-Signature)\s*[:=]\s*["']?[^\s,"']+/gi, '$1=[redacted]').replace(/data:image\/[^\s]+/gi, '[image redacted]').replace(/https?:\/\/[^\s"']+/gi, '[upstream URL]').replace(/[\r\n\u0000-\u001f]+/g, ' ').slice(0, 500);
  }
  function status() {
    return { available: configured && !closed, configured, provider: 'lovart', providers: [{ id: 'lovart', label: 'Lovart', configured }], supportedModels: config.models.map(model => ({ id: model.id, label: model.label, tool: model.tool })), selectionMode: config.selectionMode, ratioControl: config.ratioControl, supportedRatios: RATIOS, maxReferences: MAX_REFERENCES, maxImageBytes: MAX_REFERENCE_BYTES, maxTotalReferenceBytes: MAX_TOTAL_REFERENCE_BYTES, referenceRoles: ROLES, timeoutMs, concurrency: 1, queueLimit: maxQueued, activeJobs: running ? 1 : 0, queuedJobs: queue.length, cancellation: CANCELLATION, message: closed ? '本机生图服务已关闭' : configured ? '已配置Lovart凭证；模型选择为平台偏好设置' : '请在本地服务器配置LOVART_ACCESS_KEY与LOVART_SECRET_KEY' };
  }
  function normalize(body) {
    if (!plainObject(body)) reject(400, 'INVALID_INPUT', '请提交生图参数');
    if (Object.keys(body).some(key => !['model', 'prompt', 'ratio', 'references'].includes(key))) reject(400, 'INVALID_INPUT', '生图参数只接受model、prompt、ratio、references');
    const model = config.models.find(item => item.id === body.model);
    if (!model) reject(400, 'INVALID_MODEL', '模型仅支持Image 2、Image 2.5、Nano Banana Pro');
    if (!RATIOS.includes(body.ratio)) reject(400, 'INVALID_RATIO', '画幅仅支持1:1、4:5、16:9、9:16');
    if (typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 16000) reject(400, 'INVALID_PROMPT', '请提交有效Prompt（最多16000字）');
    if (/openx|1000x|one\s*thousand\s*x/i.test(body.prompt)) reject(400, 'BRAND_IN_PROMPT', '生图Prompt请描述视觉本身，品牌文字由后期排版');
    const references = body.references ?? [];
    if (!Array.isArray(references) || references.length > MAX_REFERENCES) reject(400, 'INVALID_REFERENCES', '原始参考最多10张');
    let total = 0;
    const normalized = references.map((reference, index) => {
      if (!plainObject(reference) || reference.source !== 'original') reject(400, 'ORIGINAL_REQUIRED', '只接受原始照片或官方角色原档，禁止使用生成结果再次参考');
      if (!ROLES.includes(reference.role)) reject(400, 'INVALID_REFERENCE_ROLE', '请明确每张原图的参考作用');
      if (Object.keys(reference).some(key => !['dataUrl', 'name', 'role', 'source'].includes(key))) reject(400, 'INVALID_REFERENCE', '参考图参数无效');
      const match = typeof reference.dataUrl === 'string' && /^data:(image\/png|image\/jpeg|image\/webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(reference.dataUrl);
      if (!match || match[2].length > Math.ceil(MAX_REFERENCE_BYTES / 3) * 4 + 4) reject(413, 'INVALID_REFERENCE_IMAGE', '请上传单张不超过8MiB的PNG、JPEG或WebP原图');
      const buffer = Buffer.from(match[2], 'base64');
      if (!buffer.length || buffer.length > MAX_REFERENCE_BYTES || buffer.toString('base64').replace(/=+$/, '') !== match[2].replace(/=+$/, '')) reject(400, 'INVALID_REFERENCE_IMAGE', '参考图编码无效');
      total += buffer.length;
      if (total > MAX_TOTAL_REFERENCE_BYTES) reject(413, 'REFERENCES_TOO_LARGE', '原始参考合计不能超过24MiB');
      const info = imageInfo(buffer, match[1]);
      const hash = crypto.createHash('sha256').update(buffer).digest('hex');
      if (generatedHashes.has(hash)) reject(400, 'GENERATED_REFERENCE_REJECTED', '该图片是本服务的生成结果，请重新上传原始参考');
      const rawName = typeof reference.name === 'string' ? reference.name : 'reference-' + (index + 1);
      const name = rawName.split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f"\r\n]/g, '').slice(0, 100) || 'reference-' + (index + 1);
      return { ...info, buffer, name, role: reference.role, source: 'original' };
    });
    return { model, prompt: body.prompt.trim(), ratio: body.ratio, references: normalized };
  }
  function publicJob(job) {
    return { jobId: job.id, status: job.status, createdAt: job.createdAt, ...(job.startedAt ? { startedAt: job.startedAt } : {}), ...(job.finishedAt ? { finishedAt: job.finishedAt } : {}), ...(job.result ? { result: job.result } : {}), ...(job.error ? { error: job.error } : {}), ...(job.cancellation ? { cancellation: job.cancellation } : {}) };
  }
  function expire() {
    const now = Date.now();
    for (const [id, job] of jobs) if (job.finishedAt && now - Date.parse(job.finishedAt) > ttlMs) jobs.delete(id);
  }
  async function request(job, method, endpoint, body, query, upload) {
    job.controller.signal.throwIfAborted();
    const path = config.pathPrefix + endpoint, url = new URL(config.apiBase + path);
    for (const [key, value] of Object.entries(query || {})) url.searchParams.set(key, value);
    const headers = { ...signature(method, path, accessKey, secretKey), 'User-Agent': 'LovartLocalImageWorkbench/1.0' };
    if (method === 'POST') headers['Idempotency-Key'] = crypto.randomUUID();
    let requestBody;
    if (upload) {
      requestBody = new FormData();
      requestBody.append('file', new Blob([upload.buffer], { type: upload.mime }), upload.name);
    } else if (body !== undefined) { headers['Content-Type'] = 'application/json'; requestBody = JSON.stringify(body); }
    // No automatic generation resubmission: an interrupted response can still bill.
    const response = await fetcher(url, { method, headers, body: requestBody, redirect: 'error', signal: job.controller.signal });
    const bytes = await boundedBytes(response, 2 * 1024 * 1024, job.controller.signal);
    let value;
    try { value = JSON.parse(bytes.toString('utf8')); } catch { reject(502, 'INVALID_LOVART_RESPONSE', 'Lovart返回了无效JSON'); }
    if (!response.ok || plainObject(value) && value.code !== undefined && value.code !== 0) {
      const detail = value.message || (typeof value.error === 'string' ? value.error : value.error?.message) || '平台请求失败';
      reject(response.status === 401 || response.status === 403 ? 502 : response.status === 429 ? 429 : 502, response.status === 429 ? 'LOVART_RATE_LIMITED' : 'LOVART_REQUEST_FAILED', 'Lovart：' + cleanError(detail));
    }
    const data = plainObject(value) && Object.hasOwn(value, 'data') ? value.data : value;
    if (!plainObject(data)) reject(502, 'INVALID_LOVART_RESPONSE', 'Lovart结果结构无效');
    return data;
  }
  function pause(job, duration) {
    return new Promise((resolve, rejectPause) => {
      const signal = job.controller.signal;
      signal.throwIfAborted();
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, duration);
      function abort() { clearTimeout(timer); signal.removeEventListener('abort', abort); rejectPause(signal.reason || new Error('已取消')); }
      signal.addEventListener('abort', abort, { once: true });
    });
  }
  async function download(job, content) {
    let url;
    try { url = new URL(content); } catch { reject(502, 'INVALID_ARTIFACT_URL', 'Lovart图像地址无效'); }
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.port && url.port !== '443' || !(host === 'lovart.ai' || host.endsWith('.lovart.ai') || extraAssetHosts.has(host))) reject(502, 'ARTIFACT_HOST_REJECTED', 'Lovart图像域名未获服务器允许');
    const addresses = await lookup(host, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(item => !publicAddress(item.address))) reject(502, 'ARTIFACT_HOST_REJECTED', '图像地址未解析到公共网络');
    const response = await fetcher(url, { method: 'GET', headers: { Referer: 'https://www.lovart.ai/' }, redirect: 'error', signal: job.controller.signal });
    if (!response.ok) reject(502, 'ARTIFACT_DOWNLOAD_FAILED', 'Lovart图像下载失败（HTTP ' + response.status + '）');
    const buffer = await boundedBytes(response, MAX_RESULT_BYTES, job.controller.signal);
    let info;
    try { info = imageInfo(buffer); } catch { reject(502, 'INVALID_GENERATED_IMAGE', 'Lovart返回的图像内容无效'); }
    return { buffer, ...info };
  }
  async function generate(job) {
    const payload = job.payload, attachments = [];
    // Fresh project and thread for every revision. Never load previous outputs.
    const project = await request(job, 'POST', '/project/save', { project_id: '', canvas: '', project_cover_list: [], pic_count: 0, project_type: 3, project_name: 'Image ' + job.id.slice(0, 8) });
    if (typeof project.project_id !== 'string' || !project.project_id) reject(502, 'PROJECT_MISSING', 'Lovart未返回新项目编号');
    for (const reference of payload.references) {
      const uploaded = await request(job, 'POST', '/file/upload', undefined, undefined, reference);
      if (typeof uploaded.url !== 'string' || !/^https:\/\//.test(uploaded.url)) reject(502, 'UPLOAD_FAILED', 'Lovart未返回原始参考图上传地址');
      attachments.push(uploaded.url);
    }
    const roleNames = { appearance: '外观', character: '官方角色外观', subject: '主体', composition: '原始构图', style: '风格', material: '材质', background: '背景' };
    const referenceRules = payload.references.length ? '\n原始参考用途（按附件顺序）：' + payload.references.map((reference, index) => (index + 1) + '=' + roleNames[reference.role]).join('；') + '。只按这些用途参考，保留官方角色原档已有胸标；不复制参考图其他标题与文字。' : '';
    const executionRules = '\n执行要求：只生成1张完整底图，画幅' + payload.ratio + '，完整展示主体，不裁切主要部位。只使用所选图像模型；该模型不可用就返回失败，不改用其他模型，不重试被拒绝的参考。品牌文案、Logo和slogan由后期处理，不生成新的文字。每次从原始照片或官方角色原档重新生成，禁止使用任何生成结果作为第二、三次参考。' + referenceRules;
    const sent = await request(job, 'POST', '/chat', { prompt: payload.prompt + executionRules, project_id: project.project_id, mode: 'fast', ...(attachments.length ? { attachments } : {}), tool_config: { prefer_tool_categories: { IMAGE: [payload.model.tool] }, include_tools: [payload.model.tool] } });
    if (typeof sent.thread_id !== 'string' || !sent.thread_id) reject(502, 'THREAD_MISSING', 'Lovart未返回任务编号');
    job.upstreamThreadId = sent.thread_id;
    let checks = 0, completed;
    while (!completed) {
      const state = await request(job, 'GET', '/chat/status', undefined, { thread_id: sent.thread_id });
      checks++;
      if (state.status === 'abort') reject(502, 'LOVART_ABORTED', 'Lovart已终止该生成任务');
      if (state.status === 'pending_confirmation') reject(409, 'LOVART_CONFIRMATION_REQUIRED', 'Lovart需要额外费用确认，请到平台处理；本工具不会自动确认');
      if (state.status === 'done') {
        await pause(job, doneDelayMs);
        const second = await request(job, 'GET', '/chat/status', undefined, { thread_id: sent.thread_id });
        if (second.status === 'abort') reject(502, 'LOVART_ABORTED', 'Lovart已终止该生成任务');
        if (second.status === 'done') completed = await request(job, 'GET', '/chat/result', undefined, { thread_id: sent.thread_id });
      } else if (checks >= 7 && checks % 3 === 0) {
        const interim = await request(job, 'GET', '/chat/result', undefined, { thread_id: sent.thread_id });
        if (interim.pending_confirmation) reject(409, 'LOVART_CONFIRMATION_REQUIRED', 'Lovart需要额外费用确认，请到平台处理；本工具不会自动确认');
        if (Array.isArray(interim.failures) && interim.failures.length) reject(502, 'LOVART_TOOL_FAILED', 'Lovart模型或参考图调用失败；已停止等待，避免把替代结果当作成功');
      }
      if (!completed) await pause(job, pollMs);
    }
    if (completed.pending_confirmation) reject(409, 'LOVART_CONFIRMATION_REQUIRED', 'Lovart需要额外费用确认，请到平台处理；本工具不会自动确认');
    if (Array.isArray(completed.failures) && completed.failures.length) {
      const first = completed.failures[0];
      reject(502, 'LOVART_TOOL_FAILED', 'Lovart生成中存在失败调用，可能已替换模型或丢弃参考：' + cleanError(first.message || first.code || '请检查平台任务'));
    }
    const artifacts = [];
    for (const item of Array.isArray(completed.items) ? completed.items : []) {
      for (const artifact of Array.isArray(item.artifacts) ? item.artifacts : []) {
        if (artifact.type === 'image' && typeof artifact.content === 'string') artifacts.push({ artifact, item });
      }
    }
    if (!artifacts.length) reject(502, 'NO_GENERATED_IMAGE', 'Lovart结束了任务，但未返回生成图像；不会用示例图替代');
    const { artifact, item } = artifacts[0], tool = actualTool(artifact, item), actualModel = tool ? modelFamily(tool) : null;
    if (tool && actualModel !== payload.model.id) reject(502, 'MODEL_MISMATCH', 'Lovart报告的实际模型与所选模型不一致，结果未采用');
    const output = await download(job, artifact.content);
    const hash = crypto.createHash('sha256').update(output.buffer).digest('hex');
    generatedHashes.add(hash);
    while (generatedHashes.size > 256) generatedHashes.delete(generatedHashes.values().next().value);
    const [rw, rh] = payload.ratio.split(':').map(Number);
    const ratioVerified = output.width ? Math.abs(output.width / output.height - rw / rh) / (rw / rh) < 0.01 : false;
    const warnings = [];
    if (!tool) warnings.push('Lovart未提供实际模型标识，无法核验是否采用所选模型');
    if (!ratioVerified) warnings.push('平台未输出可核验的目标画幅或尺寸不一致，请检查完整画布');
    if (artifacts.length > 1) warnings.push('Lovart返回了多张图，本次采用第一张');
    return { dataUrl: 'data:' + output.mime + ';base64,' + output.buffer.toString('base64'), mime: output.mime, ...(output.width ? { width: output.width, height: output.height } : {}), prompt: payload.prompt, provider: 'lovart', model: actualModel, actualModel, actualModelVerified: Boolean(tool), actualTool: tool, requestedModel: payload.model.id, requestedTool: payload.model.tool, selectionMode: 'preference', ratio: payload.ratio, ratioVerified, createdAt: new Date().toISOString(), source: 'generated', referenceCount: payload.references.length, referenceRoles: payload.references.map(reference => reference.role), ...(warnings.length ? { warnings } : {}) };
  }
  function stop(job, code, message, canceled = false) {
    if (!['queued', 'running'].includes(job.status)) return;
    const active = job.status === 'running';
    job.status = canceled ? 'canceled' : 'failed'; job.error = { code, message }; job.finishedAt = new Date().toISOString();
    if (active) job.cancellation = CANCELLATION;
    job.controller.abort(new Error(message)); clearTimeout(job.timer);
    const index = queue.indexOf(job.id); if (index >= 0) queue.splice(index, 1);
    if (!active) job.payload = null;
    if (!running) pump();
  }
  async function run(job) {
    try {
      job.status = 'running'; job.startedAt = new Date().toISOString();
      const result = await generate(job);
      if (job.status === 'running') { job.result = result; job.status = 'completed'; job.finishedAt = new Date().toISOString(); }
    } catch (error) {
      if (job.status === 'running') { job.status = 'failed'; job.error = { code: error.code || 'GENERATION_FAILED', message: cleanError(error.message) }; job.finishedAt = new Date().toISOString(); if (job.upstreamThreadId) job.cancellation = CANCELLATION; }
    } finally { clearTimeout(job.timer); job.payload = null; running = null; pump(); }
  }
  function pump() {
    if (running || closed) return;
    while (queue.length) {
      const job = jobs.get(queue.shift()); if (!job || job.status !== 'queued') continue;
      running = job.id; void run(job); break;
    }
  }
  function addJob(body) {
    if (!configured || closed) reject(503, 'LOVART_NOT_CONFIGURED', status().message);
    expire();
    if (queue.length >= maxQueued) reject(429, 'QUEUE_FULL', '已有生图任务排队，请稍后再试');
    const payload = normalize(body);
    while (jobs.size >= maxRetained) {
      const oldest = [...jobs.values()].find(job => !['queued', 'running'].includes(job.status));
      if (!oldest) reject(429, 'QUEUE_FULL', '本地任务数量已满');
      jobs.delete(oldest.id);
    }
    const job = { id: crypto.randomUUID(), status: 'queued', createdAt: new Date().toISOString(), payload, controller: new AbortController() };
    jobs.set(job.id, job); queue.push(job.id);
    job.timer = setTimeout(() => stop(job, 'GENERATION_TIMEOUT', 'Lovart生图超过8分钟，已停止本地等待'), timeoutMs); job.timer.unref();
    pump(); return publicJob(job);
  }
  function getJob(id) { expire(); const job = jobs.get(id); if (!job) reject(404, 'JOB_NOT_FOUND', '任务不存在或结果已过期'); return publicJob(job); }
  function cancelJob(id) {
    const job = jobs.get(id); if (!job) reject(404, 'JOB_NOT_FOUND', '任务不存在或结果已过期');
    stop(job, 'CANCELED', job.status === 'running' ? CANCELLATION.message : '排队生成已取消，尚未提交Lovart', true);
    return publicJob(job);
  }
  function close() { closed = true; for (const job of jobs.values()) stop(job, 'CANCELED', '本机生图服务已关闭', true); }
  return { status, addJob, getJob, cancelJob, close, expire, cleanError };
}

module.exports = { createImageGenerationService, ImageGenerationError, MAX_BODY_BYTES, signature, imageInfo, publicAddress, modelFamily };
