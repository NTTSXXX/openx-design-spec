/* Local-only project drafts and generated assets for the OpenX social editor. */
(() => {
  'use strict';

  const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
  const MAX_JSON_BYTES = 30 * 1024 * 1024;
  const MAX_STRING_LENGTH = 10000;
  const RATIOS = ['1:1', '4:5', '16:9', '9:16'];
  const LOGO_ASSETS = ['OnLight','OnDark','Black','White'].map(name=>'OpenX-ONE-Horizontal-'+name+'.svg');
  const DB_NAME = 'openx-social-projects';
  const DRAFT_KEY = 'current';
  let databasePromise;

  function fail(message, code = 'INVALID_PROJECT', cause) {
    const error = new Error(message);
    error.name = 'OpenXSocialStoreError';
    error.code = code;
    if (cause) error.cause = cause;
    return error;
  }

  function object(value, label, allowed) {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
      throw fail(label + '必须是普通对象');
    }
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key)) throw fail(label + '包含不支持的字段：' + key);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor && ('get' in descriptor || 'set' in descriptor)) {
        throw fail(label + '不支持动态属性');
      }
    }
    return value;
  }

  function string(value, label, fallback, maxLength = MAX_STRING_LENGTH) {
    if (value === undefined && fallback !== undefined) value = fallback;
    if (typeof value !== 'string' || value.length > maxLength) {
      throw fail(label + '必须是最多' + maxLength + '字符的文字');
    }
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value) ||
        /<\s*\/?\s*(?:script|iframe|object|embed|svg|img|style|link|meta|base)\b|<[^>]*\bon[a-z]+\s*=|(?:javascript|vbscript)\s*:|data\s*:\s*(?:text\/html|application\/javascript)/i.test(value)) {
      throw fail(label + '包含不支持的脚本内容');
    }
    return value;
  }

  function number(value, label, min, max, fallback, integer = false) {
    if (value === undefined && fallback !== undefined) value = fallback;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min ||
        value > max || (integer && !Number.isInteger(value))) {
      throw fail(label + '必须是' + min + '至' + max + '之间的' + (integer ? '整数' : '数字'));
    }
    return value;
  }

  function choice(value, label, choices, fallback) {
    if (value === undefined && fallback !== undefined) value = fallback;
    if (!choices.includes(value)) throw fail(label + '取值不受支持');
    return value;
  }

  function boolean(value, label, fallback = false) {
    if (value === undefined) value = fallback;
    if (typeof value !== 'boolean') throw fail(label + '必须是布尔值');
    return value;
  }

  function color(value, label, fallback) {
    value = string(value, label, fallback, 9);
    if (!/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value)) {
      throw fail(label + '必须是十六进制色值');
    }
    return value.toUpperCase();
  }

  function timestamp(value, label) {
    if (value === undefined) return new Date().toISOString();
    value = string(value, label, undefined, 40);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
        !Number.isFinite(Date.parse(value))) {
      throw fail(label + '必须是有效的 ISO 时间');
    }
    return new Date(value).toISOString();
  }

  function imageData(value, label) {
    if (typeof value !== 'string') throw fail(label + '必须是图片 data URL');
    // Bound the string before matching or decoding it. External URLs and SVG are rejected.
    if (value.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 32) {
      throw fail(label + '图片不能超过20MB');
    }
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z\d+/]+={0,2})$/.exec(value);
    if (!match || match[2].length % 4 !== 0) {
      throw fail(label + '仅支持 PNG、JPEG 或 WebP 的 base64 data URL');
    }
    const encoded = match[2];
    const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
    const bytes = encoded.length / 4 * 3 - padding;
    if (bytes > MAX_IMAGE_BYTES) throw fail(label + '图片不能超过20MB');
    let header;
    try { header = atob(encoded.slice(0, 64)); }
    catch (error) { throw fail(label + '图片编码无效', 'INVALID_PROJECT', error); }
    const byte = index => header.charCodeAt(index);
    const valid = match[1] === 'image/png' ?
      bytes >= 24 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => byte(index) === value) && header.slice(12, 16) === 'IHDR' :
      match[1] === 'image/jpeg' ? bytes >= 4 && byte(0) === 255 && byte(1) === 216 && byte(2) === 255 :
        bytes >= 16 && header.slice(0, 4) === 'RIFF' && header.slice(8, 12) === 'WEBP';
    if (!valid) throw fail(label + '图片内容与格式不匹配');
    return value;
  }

  function jsonSize(value) {
    let json;
    try { json = JSON.stringify(value); }
    catch (error) { throw fail('项目必须是可序列化的 JSON', 'INVALID_PROJECT', error); }
    if (typeof json !== 'string' || new TextEncoder().encode(json).byteLength > MAX_JSON_BYTES) {
      throw fail('项目 JSON 不能超过30MB');
    }
    return json;
  }

  function validate(project) {
    object(project, '项目', ['kind', 'version', 'templateId', 'canvas', 'texts', 'background', 'logo', 'generation', 'savedAt']);
    if (project.kind !== 'openx-social-project' || project.version !== 1) {
      throw fail('请选择 OpenX 社媒项目 v1 文件');
    }
    const templateId = string(project.templateId, '模板编号', undefined, 128);
    if (!/^[A-Za-z0-9][A-Za-z\d._:-]*$/.test(templateId)) throw fail('模板编号格式无效');
    const canvas = object(project.canvas, '画布', ['width', 'height']);
    const width = number(canvas.width, '画布宽度', 1, 16384, undefined, true);
    const height = number(canvas.height, '画布高度', 1, 16384, undefined, true);
    let logo;
    if(project.logo!==undefined){
      const entry=object(project.logo,'Logo',['asset','x','y','w','h']);
      logo={asset:choice(entry.asset,'Logo 原档',LOGO_ASSETS),x:number(entry.x,'Logo 横坐标',0,width),y:number(entry.y,'Logo 纵坐标',0,height),w:number(entry.w,'Logo 宽度',1,width),h:number(entry.h,'Logo 高度',1,height)};
      if(logo.x+logo.w>width||logo.y+logo.h>height)throw fail('Logo 超出当前画布');
    }
    if (!Array.isArray(project.texts) || project.texts.length > 30) throw fail('项目最多支持30个文字区域');
    const texts = project.texts.map((entry, index) => {
      const label = '文字区域' + (index + 1);
      object(entry, label, ['name', 'content', 'family', 'size', 'weight', 'lineHeight', 'color', 'align', 'x', 'y', 'maxWidth', 'maxLines', 'highlights', 'highlightColor', 'manualPosition', 'colorRanges']);
      const highlights = entry.highlights === undefined ? [] : entry.highlights;
      if (!Array.isArray(highlights) || highlights.length > 30) throw fail(label + '最多支持30个强调词');
      const content=string(entry.content,label+'文案');
      let colorRanges;
      if(entry.colorRanges!==undefined){
        if(!Array.isArray(entry.colorRanges)||entry.colorRanges.length>300)throw fail(label+'最多支持300段独立颜色');
        const boundaries=new Set([0,content.length]);
        for(const part of new Intl.Segmenter('zh',{granularity:'grapheme'}).segment(content))boundaries.add(part.index);
        let end=0;colorRanges=entry.colorRanges.map((range,index)=>{
          const name=label+'局部颜色'+(index+1);object(range,name,['start','end','color']);
          const start=number(range.start,name+'起点',0,content.length,undefined,true),stop=number(range.end,name+'终点',1,content.length,undefined,true);
          if(start>=stop||start<end||!boundaries.has(start)||!boundaries.has(stop))throw fail(name+'范围应按顺序排列、不重叠且包含完整字符');
          end=stop;return{start,end:stop,color:color(range.color,name+'颜色')};
        });
      }
      return {
        name: string(entry.name, label + '名称'),
        content,
        family: choice(entry.family, label + '字体', ['title', 'body', 'tc', 'system'], 'body'),
        size: number(entry.size, label + '字号', 1, 2048),
        weight: number(entry.weight, label + '字重', 1, 1000, 600, true),
        lineHeight: number(entry.lineHeight, label + '行高', 1, 4096),
        color: color(entry.color, label + '颜色'),
        align: choice(entry.align, label + '对齐', ['left', 'center', 'right'], 'left'),
        x: number(entry.x, label + '横坐标', 0, width),
        y: number(entry.y, label + '纵坐标', 0, height),
        maxWidth: number(entry.maxWidth, label + '最大宽度', 1, width),
        maxLines: number(entry.maxLines, label + '最大行数', 1, 100, 1, true),
        highlights: highlights.map((value, highlightIndex) => string(value, label + '强调词' + (highlightIndex + 1))),
        highlightColor: color(entry.highlightColor, label + '强调色', '#FF8200'),
        manualPosition: boolean(entry.manualPosition, label + '手动位置'),
        ...(colorRanges?{colorRanges}:{})
      };
    });
    let background = null;
    if (project.background !== undefined && project.background !== null) {
      const entry = object(project.background, '底图', ['hidden', 'dataUrl', 'name', 'fit', 'scale', 'scaleX', 'scaleY', 'offsetX', 'offsetY', 'x', 'y', 'brightness', 'contrast', 'saturation', 'fill']);
      const hidden = boolean(entry.hidden, '底图删除状态');
      if(hidden && entry.dataUrl !== undefined && entry.dataUrl !== null && entry.dataUrl !== '')throw fail('已删除底图不应包含图片数据');
      background = {
        hidden,
        dataUrl: hidden ? null : imageData(entry.dataUrl, '底图'),
        name: string(entry.name, '底图名称', ''),
        fit: choice(entry.fit, '底图铺放方式', ['contain', 'cover'], 'contain'),
        scale: number(entry.scale, '底图缩放', .5, 2, 1),
        x: number(entry.x, '底图水平位置', 0, 100, 50),
        y: number(entry.y, '底图垂直位置', 0, 100, 50),
        brightness: number(entry.brightness, '底图亮度', 80, 120, 100),
        contrast: number(entry.contrast, '底图对比度', 80, 120, 100),
        saturation: number(entry.saturation, '底图饱和度', 0, 150, 100),
        fill: color(entry.fill, '底图留边颜色', '#0B0B0B'),
        ...(entry.scaleX===undefined?{}:{scaleX:number(entry.scaleX,'底图横向倍率',.05,10)}),
        ...(entry.scaleY===undefined?{}:{scaleY:number(entry.scaleY,'底图纵向倍率',.05,10)}),
        ...(entry.offsetX===undefined?{}:{offsetX:number(entry.offsetX,'底图横向偏移',-width*100,width*100)}),
        ...(entry.offsetY===undefined?{}:{offsetY:number(entry.offsetY,'底图纵向偏移',-height*100,height*100)})
      };
    }
    const inputGeneration = project.generation === undefined ? {} : object(project.generation, '生成设置', ['prompt', 'ratio', 'style', 'topic', 'composition', 'model']);
    const generation = {
      prompt: string(inputGeneration.prompt, '生成提示词', ''),
      ratio: choice(inputGeneration.ratio, '生成比例', RATIOS, '1:1'),
      style: string(inputGeneration.style, '生成风格', ''),
      topic: string(inputGeneration.topic, '生成主题', ''),
      composition: string(inputGeneration.composition, '生成构图', ''),
      model: string(inputGeneration.model, '生成模型', '')
    };
    const sanitized = { kind: 'openx-social-project', version: 1, templateId, canvas: { width, height }, texts, background, generation, savedAt: timestamp(project.savedAt, '保存时间') };
    if(logo)sanitized.logo=logo;
    jsonSize(sanitized);
    return sanitized;
  }

  function storageFailure(error) {
    return fail('本地存储操作失败，请检查浏览器存储权限与剩余空间；本次操作未确认保存', 'STORAGE_FAILED', error);
  }

  function openDatabase() {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      let request;
      let settled = false;
      try {
        if (!window.indexedDB) throw fail('浏览器不支持 IndexedDB，无法保存本地项目', 'STORAGE_UNAVAILABLE');
        request = window.indexedDB.open(DB_NAME, 1);
      } catch (error) { reject(error.code ? error : storageFailure(error)); return; }
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('drafts')) db.createObjectStore('drafts', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('assets')) {
          const assets = db.createObjectStore('assets', { keyPath: 'id' });
          assets.createIndex('createdAt', 'createdAt');
        }
      };
      request.onerror = () => { settled = true; reject(storageFailure(request.error)); };
      request.onblocked = () => {
        settled = true;
        reject(fail('本地数据库被其他页面占用，请关闭其他编辑页面后重试', 'STORAGE_BLOCKED'));
      };
      request.onsuccess = () => {
        const db = request.result;
        if (settled) { db.close(); return; }
        db.onversionchange = () => { db.close(); databasePromise = undefined; };
        resolve(db);
      };
    });
    databasePromise.catch(() => { databasePromise = undefined; });
    return databasePromise;
  }

  async function transaction(storeName, mode, action) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      let tx;
      let result;
      let request;
      try {
        tx = db.transaction(storeName, mode);
        request = action(tx.objectStore(storeName));
      } catch (error) {
        if (tx) tx.abort();
        reject(storageFailure(error));
        return;
      }
      request.onsuccess = () => { result = request.result; };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(storageFailure(tx.error || request.error));
      tx.onerror = () => reject(storageFailure(tx.error || request.error));
    });
  }

  async function saveDraft(project) {
    const sanitized = validate(project);
    sanitized.savedAt = new Date().toISOString();
    await transaction('drafts', 'readwrite', store => store.put({ id: DRAFT_KEY, project: sanitized }));
    return sanitized;
  }

  async function loadDraft() {
    const record = await transaction('drafts', 'readonly', store => store.get(DRAFT_KEY));
    return record ? validate(record.project) : null;
  }

  async function clearDraft() {
    await transaction('drafts', 'readwrite', store => store.delete(DRAFT_KEY));
  }

  function download(project) {
    const sanitized = validate(project);
    const json = JSON.stringify(sanitized, null, 2);
    if (new TextEncoder().encode(json).byteLength > MAX_JSON_BYTES) throw fail('项目 JSON 不能超过30MB');
    const name = 'OpenX-social-' + sanitized.templateId.replace(/[^A-Za-z\d._-]/g, '-') + '.json';
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.hidden = true;
    document.body.append(link);
    try { link.click(); }
    finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    return name;
  }

  async function readFile(file) {
    if (!(file instanceof Blob)) throw fail('请选择 JSON 项目文件');
    if (file.size > MAX_JSON_BYTES) throw fail('项目 JSON 不能超过30MB');
    let value;
    try {
      const text = await file.text();
      value = JSON.parse(text.replace(/^\uFEFF/, ''));
    } catch (error) { throw fail('项目文件不是有效的 JSON', 'INVALID_JSON', error); }
    return validate(value);
  }

  function assetId(value) {
    value = string(value, '素材编号', undefined, 128);
    if (!/^[A-Za-z\d][A-Za-z\d_-]*$/.test(value)) throw fail('素材编号格式无效', 'INVALID_ASSET');
    return value;
  }

  function validateAsset(input) {
    object(input, '生成素材', ['id', 'dataUrl', 'name', 'prompt', 'model', 'ratio', 'createdAt', 'source']);
    const id = input.id === undefined ? crypto.randomUUID() : assetId(input.id);
    return {
      id,
      dataUrl: imageData(input.dataUrl, '生成素材'),
      name: string(input.name, '素材名称', 'OpenX 生成素材'),
      prompt: string(input.prompt, '素材提示词', ''),
      model: string(input.model, '素材模型', ''),
      ratio: choice(input.ratio, '素材比例', RATIOS, '1:1'),
      createdAt: timestamp(input.createdAt, '素材生成时间'),
      source: choice(input.source, '素材来源', ['generated'], 'generated')
    };
  }

  async function addAsset(input) {
    const asset = validateAsset(input);
    await transaction('assets', 'readwrite', store => store.add(asset));
    return asset;
  }

  async function listAssets() {
    const assets = await transaction('assets', 'readonly', store => store.getAll());
    return assets.map(validateAsset).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  }

  async function getAsset(id) {
    const asset = await transaction('assets', 'readonly', store => store.get(assetId(id)));
    return asset ? validateAsset(asset) : null;
  }

  async function deleteAsset(id) {
    await transaction('assets', 'readwrite', store => store.delete(assetId(id)));
  }

  // Assets are only stored and retrieved here. No asset is selected, applied, or sent anywhere.
  window.OpenXSocialStore = Object.freeze({ saveDraft, loadDraft, clearDraft, validate, download, readFile, addAsset, listAssets, getAsset, deleteAsset });
})();
