'use strict';

// Mock-fetch contract tests only: no network, no Lovart credits, no live image.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { createImageGenerationService, signature, imageInfo, publicAddress } = require('./image-generation.cjs');
const ENV = { LOVART_ACCESS_KEY: 'test-access-do-not-use', LOVART_SECRET_KEY: 'test-secret-do-not-use' };
const PROMPT = '主体动作：白色圆球机器人斜向飞行，手臂自然展开。\n构图：右侧主体，前后景尺度差。\n颜色材质：白色烤漆、黑色玻璃、橙色连接。\n背景光照：深石墨背景，柔和真实光照。\n留白：左侧保留文案区域。\n限制：最多两张图标卡片，不新增文字，每次从原档重新生成。';
function png(width, height, color = [220, 220, 220]) {
  function crc(buffer) { let value = -1; for (const byte of buffer) { value ^= byte; for (let i = 0; i < 8; i++) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1; } return (value ^ -1) >>> 0; }
  function chunk(type, data) { const head = Buffer.alloc(4), tail = Buffer.alloc(4), name = Buffer.from(type); head.writeUInt32BE(data.length); tail.writeUInt32BE(crc(Buffer.concat([name, data]))); return Buffer.concat([head, name, data, tail]); }
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  const raw = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (let i = 0; i < 3; i++) raw[y * (width * 3 + 1) + 1 + x * 3 + i] = color[i];
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const SOURCE = png(12, 12, [255, 128, 0]), OUTPUT = png(32, 32);
function reference(role = 'character', bytes = SOURCE, source = 'original') { return { dataUrl: 'data:image/png;base64,' + bytes.toString('base64'), name: 'official.png', role, source }; }
function input(overrides = {}) { return { model: 'image2.5', prompt: PROMPT, ratio: '1:1', references: [], ...overrides }; }
function fixture(settings = {}) {
  const calls = [];
  let projectCount = 0, threadCount = 0;
  async function fetcher(url, init) {
    const uri = new URL(url), body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
    calls.push({ path: uri.pathname, query: uri.search, headers: init.headers, body, method: init.method });
    if (init.signal.aborted) throw init.signal.reason;
    if (uri.hostname === 'assets-persist.lovart.ai') return new Response(settings.output || OUTPUT, { headers: { 'Content-Type': 'image/png' } });
    const prefix = '/v1/openapi';
    const expected = signature(init.method, uri.pathname, ENV.LOVART_ACCESS_KEY, ENV.LOVART_SECRET_KEY, Number(init.headers['X-Timestamp']) * 1000);
    assert.equal(init.headers['X-Signature'], expected['X-Signature']);
    assert.equal(init.headers['X-Signed-Path'], uri.pathname); // Query excluded.
    if (uri.pathname === prefix + '/project/save') {
      if (settings.hold) return new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true }));
      return Response.json({ code: 0, data: { project_id: 'project-' + ++projectCount } });
    }
    if (uri.pathname === prefix + '/file/upload') {
      assert.ok(body instanceof FormData); assert.ok(body.get('file') instanceof Blob);
      return Response.json({ code: 0, data: { url: 'https://assets-persist.lovart.ai/original-' + calls.length + '.png' } });
    }
    if (uri.pathname === prefix + '/chat') {
      if (settings.error) return Response.json({ code: 123, message: settings.error }, { status: 400 });
      return Response.json({ code: 0, data: { thread_id: 'thread-' + ++threadCount } });
    }
    if (uri.pathname === prefix + '/chat/status') return Response.json({ code: 0, data: { status: settings.state || 'done' } });
    if (uri.pathname === prefix + '/chat/result') {
      if (settings.result) return Response.json({ code: 0, data: settings.result });
      const tool = settings.tool === undefined ? 'generate_image_gpt_image_2_5_flare' : settings.tool;
      return Response.json({ code: 0, data: { items: [{ type: 'generator', artifacts: [{ type: 'image', content: settings.url || 'https://assets-persist.lovart.ai/artifacts/agent/output.png', ...(tool ? { tool_name: tool } : {}) }] }], failures: [] } });
    }
    throw new Error('Unexpected mock route: ' + uri);
  }
  const service = createImageGenerationService({ env: ENV, fetch: fetcher, lookup: async () => [{ address: '8.8.8.8', family: 4 }], pollMs: 1, doneDelayMs: 1, timeoutMs: settings.timeoutMs ?? 500, ttlMs: settings.ttlMs ?? 60000, ...(settings.service || {}) });
  return { service, calls };
}
async function finished(service, id, maxMs = 1000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const job = service.getJob(id);
    if (!['running', 'queued'].includes(job.status)) return job;
    await new Promise(resolve => setTimeout(resolve, 2));
  }
  throw new Error('Mock job did not finish');
}

test('missing credentials is unavailable, never invents generated image', () => {
  const service = createImageGenerationService({ env: {}, fetch: () => assert.fail('No request permitted') });
  assert.equal(service.status().available, false);
  assert.equal(service.status().selectionMode, 'preference');
  assert.equal(service.status().ratioControl, 'prompt');
  assert.deepEqual(service.status().supportedModels.map(model => model.id), ['image2', 'image2.5', 'nano-banana-pro']);
  assert.throws(() => service.addJob(input()), { code: 'LOVART_NOT_CONFIGURED', status: 503 });
  service.close();
});
test('official HMAC format matches deterministic vector', () => {
  const signed = signature('GET', '/v1/openapi/chat/status', 'ak', 'sk', 1700000000000);
  assert.equal(signed['X-Timestamp'], '1700000000');
  assert.equal(signed['X-Signature'], crypto.createHmac('sha256', 'sk').update('GET\n/v1/openapi/chat/status\n1700000000').digest('hex'));
});
test('text-to-image signs all calls, verifies model and preserves downloaded pixels', async () => {
  const { service, calls } = fixture();
  try {
    const added = service.addJob(input()), job = await finished(service, added.jobId);
    assert.equal(job.status, 'completed'); assert.equal(job.result.actualModel, 'image2.5'); assert.equal(job.result.requestedModel, 'image2.5');
    assert.equal(job.result.ratioVerified, true); assert.equal(job.result.source, 'generated');
    assert.equal(job.result.dataUrl, 'data:image/png;base64,' + OUTPUT.toString('base64'));
    const chat = calls.find(call => call.path.endsWith('/chat'));
    assert.deepEqual(chat.body.tool_config, { prefer_tool_categories: { IMAGE: ['generate_image_gpt_image_2_5_flare'] }, include_tools: ['generate_image_gpt_image_2_5_flare'] });
    assert.equal(chat.body.thread_id, undefined); assert.equal(chat.body.attachments, undefined);
    assert.ok(chat.body.prompt.startsWith(PROMPT)); assert.match(chat.body.prompt, /禁止使用任何生成结果/);
    assert.ok(chat.headers['Idempotency-Key']);
    assert.equal(calls.filter(call => call.path.endsWith('/chat/status')).length, 2);
  } finally { service.close(); }
});
test('multi-reference upload is ordered, roles explicit, every revision fresh', async () => {
  const { service, calls } = fixture();
  try {
    const job = await finished(service, service.addJob(input({ references: [reference(), reference('material'), reference('background')] })).jobId);
    assert.equal(job.status, 'completed'); assert.equal(job.result.referenceCount, 3);
    const chat = calls.find(call => call.path.endsWith('/chat'));
    assert.equal(chat.body.attachments.length, 3); assert.match(chat.body.prompt, /1=官方角色外观；2=材质；3=背景/);
    const second = await finished(service, service.addJob(input()).jobId);
    assert.equal(second.status, 'completed');
    assert.deepEqual(calls.filter(call => call.path.endsWith('/project/save')).map(call => call.body.project_id), ['', '']);
    assert.notEqual(calls.filter(call => call.path.endsWith('/chat'))[0].body.project_id, calls.filter(call => call.path.endsWith('/chat'))[1].body.project_id);
    assert.ok(calls.filter(call => call.path.endsWith('/chat')).every(call => !Object.hasOwn(call.body, 'thread_id')));
  } finally { service.close(); }
});
test('three UI model aliases map only to documented Lovart tools', async () => {
  for (const [model, tool] of [['image2', 'generate_image_gpt_image_2'], ['image2.5', 'generate_image_gpt_image_2_5_flare'], ['nano-banana-pro', 'generate_image_nano_banana_pro']]) {
    const { service, calls } = fixture({ tool });
    try { const job = await finished(service, service.addJob(input({ model })).jobId); assert.equal(job.status, 'completed'); assert.equal(job.result.actualModel, model); assert.equal(calls.find(call => call.path.endsWith('/chat')).body.tool_config.include_tools[0], tool); }
    finally { service.close(); }
  }
});
test('unknown actual model is null and clearly unverified, not requested alias', async () => {
  const { service } = fixture({ tool: null });
  try { const job = await finished(service, service.addJob(input()).jobId); assert.equal(job.status, 'completed'); assert.equal(job.result.actualModel, null); assert.equal(job.result.actualModelVerified, false); assert.match(job.result.warnings.join(' '), /无法核验/); }
  finally { service.close(); }
});
test('reported model mismatch fails, no image download or hidden substitute', async () => {
  const { service, calls } = fixture({ tool: 'generate_image_seedream_v5_pro' });
  try { const job = await finished(service, service.addJob(input()).jobId); assert.equal(job.status, 'failed'); assert.equal(job.error.code, 'MODEL_MISMATCH'); assert.equal(calls.some(call => call.method === 'GET' && call.path.endsWith('.png')), false); }
  finally { service.close(); }
});
test('no image, failures despite image, and high-cost confirmation are terminal failures', async () => {
  for (const [settings, code] of [
    [{ result: { items: [{ text: 'could not generate' }] } }, 'NO_GENERATED_IMAGE'],
    [{ result: { failures: [{ code: 'REF_REJECTED', message: 'reference refused' }], items: [{ artifacts: [{ type: 'image', content: 'https://assets-persist.lovart.ai/a.png' }] }] } }, 'LOVART_TOOL_FAILED'],
    [{ result: { pending_confirmation: { credits: 999 } } }, 'LOVART_CONFIRMATION_REQUIRED'],
    [{ state: 'abort' }, 'LOVART_ABORTED']
  ]) {
    const { service } = fixture(settings);
    try { const job = await finished(service, service.addJob(input()).jobId); assert.equal(job.status, 'failed'); assert.equal(job.error.code, code); assert.equal(job.result, undefined); }
    finally { service.close(); }
  }
});
test('original declaration mandatory, and known generated pixels rejected even relabeled original', async () => {
  const { service } = fixture();
  try {
    assert.throws(() => service.addJob(input({ references: [reference('character', SOURCE, 'generated')] })), { code: 'ORIGINAL_REQUIRED' });
    await finished(service, service.addJob(input()).jobId);
    assert.throws(() => service.addJob(input({ references: [reference('character', OUTPUT)] })), { code: 'GENERATED_REFERENCE_REJECTED' });
  } finally { service.close(); }
});
test('references, model, ratio, payload keys, image MIME and brand names validate before request', () => {
  const { service, calls } = fixture();
  try {
    for (const body of [input({ model: 'gpt-image-1' }), input({ ratio: '3:2' }), input({ apiKey: 'frontend-must-not-send' }), input({ references: Array.from({ length: 11 }, () => reference()) }), input({ references: [reference('unsupported')] }), input({ prompt: 'OpenX branded poster' })]) assert.throws(() => service.addJob(body));
    assert.throws(() => service.addJob(input({ references: [{ ...reference(), dataUrl: 'data:image/jpeg;base64,' + SOURCE.toString('base64') }] })), { code: 'INVALID_IMAGE' });
    assert.equal(calls.length, 0);
  } finally { service.close(); }
});
test('credentials/signatures/upstream URLs are redacted and generation is never retried', async () => {
  const { service, calls } = fixture({ error: ENV.LOVART_ACCESS_KEY + ' ' + ENV.LOVART_SECRET_KEY + ' X-Signature=012abc https://private.example/path?secret=value' });
  try {
    const job = await finished(service, service.addJob(input()).jobId), json = JSON.stringify(job);
    assert.equal(job.status, 'failed'); assert.ok(!json.includes(ENV.LOVART_ACCESS_KEY)); assert.ok(!json.includes(ENV.LOVART_SECRET_KEY)); assert.ok(!json.includes('012abc')); assert.ok(!json.includes('private.example'));
    assert.equal(calls.filter(call => call.path.endsWith('/chat')).length, 1);
  } finally { service.close(); }
});
test('bounded queue and active/queued cancellation stop local work with honest billing scope', async () => {
  const { service, calls } = fixture({ hold: true });
  try {
    const first = service.addJob(input()), second = service.addJob(input()), third = service.addJob(input());
    assert.throws(() => service.addJob(input()), { code: 'QUEUE_FULL', status: 429 });
    assert.equal(service.cancelJob(second.jobId).status, 'canceled');
    assert.equal(service.getJob(second.jobId).cancellation, undefined);
    const canceled = service.cancelJob(first.jobId);
    assert.equal(canceled.status, 'canceled'); assert.equal(canceled.cancellation.upstreamCancellationSupported, false); assert.equal(canceled.cancellation.billingMayContinue, true);
    service.cancelJob(third.jobId);
    await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(calls.filter(call => call.path.endsWith('/chat')).length, 0); assert.equal(service.status().queuedJobs, 0);
  } finally { service.close(); }
});
test('bounded timeout aborts fetch, expires old jobs, no substitute output', async () => {
  const { service } = fixture({ hold: true, timeoutMs: 12, ttlMs: 50 });
  try {
    const added = service.addJob(input()), job = await finished(service, added.jobId);
    assert.equal(job.status, 'failed'); assert.equal(job.error.code, 'GENERATION_TIMEOUT'); assert.equal(job.result, undefined);
    await new Promise(resolve => setTimeout(resolve, 70));
    assert.throws(() => service.getJob(added.jobId), { code: 'JOB_NOT_FOUND' });
  } finally { service.close(); }
});
test('artifact URLs cannot access local or unapproved servers; no automatic redirect', async () => {
  for (const url of ['http://127.0.0.1/internal.png', 'https://unapproved.example/a.png', 'https://user:pass@assets-persist.lovart.ai/a.png']) {
    const { service } = fixture({ url });
    try { const job = await finished(service, service.addJob(input()).jobId); assert.equal(job.status, 'failed'); assert.equal(job.error.code, 'ARTIFACT_HOST_REJECTED'); }
    finally { service.close(); }
  }
  for (const address of ['127.0.0.1', '10.0.0.1', '192.168.0.1', '169.254.169.254', '100.64.0.1', '::1', 'fc00::1', '::ffff:127.0.0.1']) assert.equal(publicAddress(address), false);
  assert.equal(publicAddress('8.8.8.8'), true);
});
test('ratio mismatch is reported and downloaded image is never cropped to fake compliance', async () => {
  const { service } = fixture({ output: png(32, 24) });
  try { const job = await finished(service, service.addJob(input()).jobId); assert.equal(job.status, 'completed'); assert.equal(job.result.ratioVerified, false); assert.equal(job.result.width, 32); assert.equal(job.result.height, 24); assert.match(job.result.warnings.join(' '), /画幅/); }
  finally { service.close(); }
});
test('image header parsing preserves actual dimensions', () => {
  assert.deepEqual(imageInfo(OUTPUT), { mime: 'image/png', width: 32, height: 32 });
  assert.throws(() => imageInfo(Buffer.from('not image')), { code: 'INVALID_IMAGE' });
});
