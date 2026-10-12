'use strict';

// Local-only preview plus a real image-to-prompt worker using the signed-in CLI.
// Never serves auth files, exposes credentials, or interprets image text as code.
const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn, execFile } = require('node:child_process');
const { developerInstructions, buildPrompt, attachLayoutTemplate } = require('./prompt-adapter-prompt.cjs');
const schema = require('./prompt-adapter-schema.json');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PROMPT_ADAPTER_PORT || 6128);
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_BODY_BYTES = 40 * 1024 * 1024;
const TIMEOUT_MS = 8 * 60 * 1000;
const RESULT_TTL_MS = 20 * 60 * 1000;
const MAX_QUEUED = 2;
const jobs = new Map();
const queue = [];
let running = null;
let shuttingDown = false;
const auth = { checking: true, available: false, message: '正在检查本机视觉分析服务' };
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.glb': 'model/gltf-binary' };

class RequestError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
function fail(status, code, message) { throw new RequestError(status, code, message); }
function cleanError(value) {
  return String(value || '视觉分析未完成').replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').replace(/\bsk-[\w-]+/g, '[redacted]').replace(/((?:access|refresh|id)_token|api[_-]?key)\s*[:=]\s*["']?[^\s,"']+/gi, '$1=[redacted]').replace(/[\r\n]+/g, ' ').slice(0, 900);
}
function findCli() {
  if (process.env.CODEX_CLI_PATH && fs.existsSync(process.env.CODEX_CLI_PATH)) return path.resolve(process.env.CODEX_CLI_PATH);
  const base = path.join(process.env.LOCALAPPDATA || '', 'OpenAI', 'Codex', 'bin');
  try {
    const candidates = fs.readdirSync(base).map(name => path.join(base, name, 'codex.exe')).filter(file => fs.existsSync(file));
    candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    if (candidates.length) return candidates[0];
  } catch {}
  return process.platform === 'win32' ? 'codex.exe' : 'codex';
}
let checkedCli = '', checkedAt = 0, authCheck = null;
function cliEnvironment() {
  const env = { ...process.env };
  for (const key of ['OPENAI_API_KEY', 'CODEX_API_KEY', 'LOVART_ACCESS_KEY', 'LOVART_SECRET_KEY', 'CODEX_THREAD_ID', 'CODEX_SESSION_ID', 'CODEX_APP_TOOLS_PIPE_PATH', 'CODEX_INTERNAL_ORIGINATOR_OVERRIDE']) delete env[key];
  return env;
}
function refreshAuth() {
  if(authCheck)return authCheck;
  const cli = findCli();
  if(cli === checkedCli && Date.now() - checkedAt < 60000)return Promise.resolve();
  auth.checking = true;
  authCheck = new Promise(resolve => execFile(cli, ['login', 'status'], { windowsHide: true, timeout: 10000, maxBuffer: 32768, env: cliEnvironment() }, (error, stdout, stderr) => {
    checkedCli = cli; checkedAt = Date.now(); auth.checking = false;
    auth.available = !error && /logged in/i.test(stdout + stderr);
    auth.message = auth.available ? '本机已登录，支持实际看图与Prompt改写' : error?.code === 'ENOENT' ? '本机未找到Codex CLI' : '本机Codex尚未登录或登录检查失败';
    resolve();
  })).finally(() => {authCheck = null;});
  return authCheck;
}
void refreshAuth();

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}
function checkLocalRequest(req, mutation) {
  const hosts = new Set(['127.0.0.1:' + PORT, 'localhost:' + PORT]);
  if (!hosts.has((req.headers.host || '').toLowerCase())) fail(403, 'LOCAL_ONLY', '仅支持本机预览地址');
  const origin = req.headers.origin;
  if (origin && !new Set(['http://127.0.0.1:' + PORT, 'http://localhost:' + PORT]).has(origin)) fail(403, 'ORIGIN_REJECTED', '只接受当前本机页面的请求');
  if (mutation && !origin) fail(403, 'ORIGIN_REQUIRED', '请求缺少本机页面来源');
}
async function readBody(req, maxBytes = MAX_BODY_BYTES) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) fail(415, 'JSON_REQUIRED', '请使用JSON提交');
  if (Number(req.headers['content-length'] || 0) > maxBytes) fail(413, 'BODY_TOO_LARGE', '上传内容超过限制');
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) fail(413, 'BODY_TOO_LARGE', '上传内容超过限制');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { fail(400, 'INVALID_JSON', '提交内容不是有效JSON'); }
}
function boundedText(value, key, max, required = false) {
  if (value === undefined && !required) return '';
  if (typeof value !== 'string') fail(400, 'INVALID_INPUT', key + ' 必须是文本');
  if (value.length > max) fail(413, 'TEXT_TOO_LONG', key + ' 超过长度限制');
  const text = value.trim();
  if (required && !text) fail(400, 'EMPTY_INSTRUCTION', '请提供目标视觉与排版规则');
  return text;
}
function imageInput(value) {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.dataUrl !== 'string') fail(400, 'INVALID_IMAGE', '请上传PNG、JPEG或WebP参考图');
  const match = /^data:(image\/png|image\/jpeg|image\/webp);base64,([A-Za-z0-9+/]*={0,2})$/.exec(value.dataUrl);
  if (!match) fail(400, 'INVALID_IMAGE', '参考图格式不支持或编码无效');
  if (match[2].length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 4) fail(413, 'IMAGE_TOO_LARGE', '参考图不能超过25MB');
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.toString('base64').replace(/=+$/, '') !== match[2].replace(/=+$/, '')) fail(400, 'INVALID_IMAGE', '参考图编码无效');
  if (buffer.length > MAX_IMAGE_BYTES) fail(413, 'IMAGE_TOO_LARGE', '参考图不能超过25MB');
  const mime = match[1];
  const valid = mime === 'image/png' ? buffer.length > 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && buffer.toString('ascii', 12, 16) === 'IHDR'
    : mime === 'image/jpeg' ? buffer.length > 4 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255
      : buffer.length > 16 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  if (!valid) fail(400, 'IMAGE_MIME_MISMATCH', '图片内容与格式不符');
  const name = typeof value.name === 'string' ? path.basename(value.name).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 120) : 'reference';
  return { mime, name: name || 'reference', extension: mime === 'image/png' ? '.png' : mime === 'image/jpeg' ? '.jpg' : '.webp', buffer };
}
function normalizeInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'INVALID_INPUT', '请提交参考图与目标规则');
  const image = imageInput(body.image);
  const instruction = boundedText(body.instruction, 'instruction', 40000, true);
  const layoutTemplate = boundedText(body.layoutTemplate, 'layoutTemplate', 20000);
  if (layoutTemplate && !/\d{2,5}\s*[×xX]\s*\d{2,5}/.test(layoutTemplate)) fail(400, 'LAYOUT_SIZE_REQUIRED', '排版模板必须包含完整画布尺寸');
  // The image wins, including when the UI accidentally sends an old template.
  const sourcePrompt = image ? '' : boundedText(body.sourcePrompt, 'sourcePrompt', 20000);
  if (!image && !sourcePrompt) fail(400, 'SOURCE_REQUIRED', '请选择参考图或填写已有Prompt');
  return { image, instruction, sourcePrompt, layoutTemplate };
}
function publicJob(job) {
  return { jobId: job.id, status: job.status, createdAt: job.createdAt, ...(job.startedAt ? { startedAt: job.startedAt } : {}), ...(job.finishedAt ? { finishedAt: job.finishedAt } : {}), ...(job.result ? { result: job.result } : {}), ...(job.error ? { error: job.error } : {}) };
}
function killChild(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') execFile('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, () => {});
  else child.kill('SIGKILL');
}
function stopJob(job, code, message, canceled = false) {
  if (!['queued', 'running'].includes(job.status)) return;
  job.status = canceled ? 'canceled' : 'failed';
  job.error = { code, message };
  job.finishedAt = new Date().toISOString();
  clearTimeout(job.timer);
  const index = queue.indexOf(job.id); if (index >= 0) queue.splice(index, 1);
  killChild(job.child);
  if (!job.child) job.payload = null;
  if (!running) pump();
}
function validateResult(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['analysis', 'changes', 'prompt', 'layout'].includes(key))) throw new Error('视觉模型返回的结果结构无效');
  if (!value.analysis || typeof value.analysis !== 'object' || Array.isArray(value.analysis) || Object.keys(value.analysis).length !== 5) throw new Error('视觉模型未返回完整画面分析');
  for (const key of ['subject', 'composition', 'materials', 'lighting', 'effects']) {
    const text = value.analysis[key];
    if (typeof text !== 'string' || text.trim().length < 8 || text.length > 2500) throw new Error('视觉模型的画面分析不完整');
  }
  for (const [key, min, max] of [['changes', 8, 5000], ['prompt', 80, 14000], ['layout', 30, 20000]]) {
    if (typeof value[key] !== 'string' || value[key].trim().length < min || value[key].length > max) throw new Error('视觉模型未返回有效' + key);
  }
  if (/openx|1000x|one\s*thousand\s*x/i.test(value.prompt)) throw new Error('生成Prompt含品牌名称，请重试视觉改写');
  return value;
}
async function runJob(job) {
  let directory;
  try {
    job.status = 'running'; job.startedAt = new Date().toISOString();
    directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'openx-prompt-adapter-'));
    const output = path.join(directory, 'answer.json'), schemaFile = path.join(directory, 'schema.json');
    await fsp.writeFile(schemaFile, JSON.stringify(schema));
    let imagePath;
    if (job.payload.image) {
      imagePath = path.join(directory, 'reference' + job.payload.image.extension);
      await fsp.writeFile(imagePath, job.payload.image.buffer);
      job.payload.image.buffer = null;
    }
    if (job.status !== 'running') return;
    const args = ['--no-daemon', 'exec', '--ignore-user-config', '--ephemeral', '--skip-git-repo-check', '--sandbox', 'read-only', '--json', '--color', 'never', '--output-schema', schemaFile, '--output-last-message', output];
    // Use the same ChatGPT login over HTTP; this machine's WebSocket route stalls.
    // No model override: the CLI chooses its default model.
    for (const config of ['model_provider="prompt_adapter_http"', 'model_providers.prompt_adapter_http={name="ChatGPT HTTPS",base_url="https://chatgpt.com/backend-api/codex",wire_api="responses",requires_openai_auth=true,supports_websockets=false}', 'approval_policy="never"', 'project_doc_max_bytes=0', 'web_search="disabled"', 'mcp_servers={}', 'history.persistence="none"', 'developer_instructions=' + JSON.stringify(developerInstructions)]) args.push('--config', config);
    for (const feature of ['shell_tool', 'unified_exec', 'apps', 'plugins', 'hooks', 'browser_use', 'browser_use_external', 'computer_use', 'image_generation', 'multi_agent', 'code_mode_host', 'view_image', 'goals', 'skill_search', 'skill_mcp_dependency_install']) args.push('--disable', feature);
    if (imagePath) args.push('--image', imagePath);
    args.push('-');
    const prompt = buildPrompt(job.payload);
    await new Promise((resolve, reject) => {
      let stderr = '', lines = '', total = 0, failure;
      const child = spawn(findCli(), args, { cwd: directory, env: cliEnvironment(), windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
      job.child = child;
      child.on('error', error => reject(new Error(error.code === 'ENOENT' ? '本机未找到Codex CLI' : cleanError(error.message))));
      child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString('utf8')).slice(-16000); });
      child.stdout.on('data', chunk => {
        total += chunk.length;
        if (total > 2 * 1024 * 1024) { failure = '视觉服务输出超出限制'; killChild(child); return; }
        lines += chunk.toString('utf8');
        let end;
        while ((end = lines.indexOf('\n')) >= 0) {
          const line = lines.slice(0, end); lines = lines.slice(end + 1);
          try {
            const event = JSON.parse(line);
            // Reconnect messages are recoverable; only terminal failure wins.
            if (event.type === 'turn.failed') failure = cleanError(event.error?.message || event.message || 'Codex视觉分析失败');
            const item = event.item;
            if (item && ['command_execution', 'mcp_tool_call', 'web_search', 'file_change', 'collab_tool_call', 'image_generation'].includes(item.type)) {
              failure = '视觉分析尝试使用额外工具，已停止该任务'; killChild(child);
            }
          } catch {}
        }
      });
      child.on('close', code => {
        job.child = null;
        if (job.status !== 'running') return reject(new Error(job.error?.message || '任务已取消'));
        if (failure) return reject(new Error(failure));
        if (code !== 0) return reject(new Error('Codex视觉分析失败：' + cleanError(stderr || '退出码 ' + code)));
        resolve();
      });
      child.stdin.on('error', () => {});
      child.stdin.end(prompt, 'utf8');
    });
    if (job.status !== 'running') return;
    const stats = await fsp.stat(output);
    if (stats.size > 256 * 1024) throw new Error('视觉分析结果超出限制');
    const result = validateResult(JSON.parse(await fsp.readFile(output, 'utf8')));
    job.result = attachLayoutTemplate(result, job.payload.layoutTemplate);
    job.status = 'completed'; job.finishedAt = new Date().toISOString();
  } catch (error) {
    if (job.status === 'running') { job.status = 'failed'; job.error = { code: 'ANALYSIS_FAILED', message: cleanError(error.message) }; job.finishedAt = new Date().toISOString(); }
  } finally {
    clearTimeout(job.timer); job.payload = null; job.child = null;
    if (directory) {
      // mkdtemp supplies the exact absolute target, and deletion stays in it.
      const resolved = path.resolve(directory), parent = path.resolve(os.tmpdir());
      if (path.dirname(resolved) === parent && path.basename(resolved).startsWith('openx-prompt-adapter-')) await fsp.rm(resolved, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }).catch(() => {});
    }
    running = null; pump();
  }
}
function pump() {
  if (running || shuttingDown) return;
  while (queue.length) {
    const job = jobs.get(queue.shift());
    if (!job || job.status !== 'queued') continue;
    running = job.id;
    void runJob(job);
    break;
  }
}
function addJob(payload) {
  if (queue.length >= MAX_QUEUED) fail(429, 'QUEUE_FULL', '已有视觉分析正在排队，请稍后再试');
  const job = { id: crypto.randomUUID(), status: 'queued', createdAt: new Date().toISOString(), payload };
  jobs.set(job.id, job); queue.push(job.id);
  job.timer = setTimeout(() => stopJob(job, 'ANALYSIS_TIMEOUT', '视觉分析超时（8分钟），请重试'), TIMEOUT_MS);
  job.timer.unref();
  pump(); return job;
}
async function api(req, res, url) {
  checkLocalRequest(req, ['POST', 'DELETE'].includes(req.method));
  if (url.pathname === '/api/prompt-adapter/status' && req.method === 'GET') {await refreshAuth();return json(res, 200, { ...auth, engine: 'codex-cli', supportsImage: true, maxImageBytes: MAX_IMAGE_BYTES, timeoutMs: TIMEOUT_MS, concurrency: 1, queueLimit: MAX_QUEUED, activeJobs: running ? 1 : 0, queuedJobs: queue.length });}
  if (url.pathname === '/api/prompt-adapter' && req.method === 'POST') {
    await refreshAuth();
    if (auth.checking) fail(503, 'SERVICE_CHECKING', '本机视觉服务正在启动，请稍后再试');
    if (!auth.available) fail(503, 'SERVICE_UNAVAILABLE', auth.message);
    const job = addJob(normalizeInput(await readBody(req)));
    return json(res, 202, { jobId: job.id, status: job.status, pollUrl: '/api/prompt-adapter/jobs/' + job.id });
  }
  const match = /^\/api\/prompt-adapter\/jobs\/([a-f0-9-]{36})$/.exec(url.pathname);
  if (match && ['GET', 'DELETE'].includes(req.method)) {
    const job = jobs.get(match[1]); if (!job) fail(404, 'JOB_NOT_FOUND', '任务不存在或结果已过期');
    if (req.method === 'DELETE') stopJob(job, 'CANCELED', '视觉分析已取消', true);
    return json(res, 200, publicJob(job));
  }
  fail(404, 'NOT_FOUND', '接口不存在');
}
async function staticFile(req, res, url) {
  if (!['GET', 'HEAD'].includes(req.method)) fail(405, 'METHOD_NOT_ALLOWED', '请求方式不支持');
  let route; try { route = decodeURIComponent(url.pathname); } catch { fail(400, 'INVALID_PATH', '路径无效'); }
  if (route.includes('\0') || route.split(/[\\/]/).some(part => part.startsWith('.'))) fail(403, 'PATH_REJECTED', '路径不可访问');
  if (route.endsWith('/')) route += 'index.html';
  const file = path.resolve(ROOT, '.' + route);
  if (!file.startsWith(ROOT + path.sep)) fail(403, 'PATH_REJECTED', '路径不可访问');
  let resolved, stats;
  try { resolved = await fsp.realpath(file); stats = await fsp.stat(resolved); }
  catch { fail(404, 'NOT_FOUND', 'Not found'); }
  if (!resolved.startsWith(ROOT + path.sep) || !stats.isFile()) fail(404, 'NOT_FOUND', 'Not found');
  res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': stats.size, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(resolved).on('error', () => res.destroy()).pipe(res);
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1:' + PORT);
    if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else await staticFile(req, res, url);
  } catch (error) {
    if (res.headersSent) return res.destroy();
    json(res, error.status || 500, { error: { code: error.code || 'SERVER_ERROR', message: cleanError(error.message) } });
  }
});
server.requestTimeout = 30000;
server.headersTimeout = 15000;
const expiry = setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs) if (job.finishedAt && now - Date.parse(job.finishedAt) > RESULT_TTL_MS) jobs.delete(id);
}, 60000); expiry.unref();
server.listen(PORT, '127.0.0.1', () => console.log('Local prompt adapter listening at http://127.0.0.1:' + PORT));
server.on('error', error => { console.error('Local prompt adapter: ' + cleanError(error.message)); process.exitCode = 1; });
function shutdown() {
  shuttingDown = true;
  for (const job of jobs.values()) stopJob(job, 'CANCELED', '本机视觉服务已关闭', true);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);

// Configuration verified against official docs on 2026-10-07:
// https://learn.chatgpt.com/docs/developer-commands?surface=cli
// https://learn.chatgpt.com/docs/config-file/config-reference
