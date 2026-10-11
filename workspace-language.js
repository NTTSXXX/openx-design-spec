/* Workbench UI language only. Authored text, artwork and project values stay intact. */
(() => {
  'use strict';
  if (window.OpenXWorkspaceLanguage) return;
  const root = document.documentElement;
  const params = new URLSearchParams(location.search);
  const mode = params.get('workspace') || (document.querySelector('.sample-toolbar') ? 'sample-toolbar' : 'rules');
  const storageKey = 'openx-language';
  const attributes = ['aria-label', 'placeholder', 'title'];
  const textRecords = new WeakMap(), attributeRecords = new WeakMap(), conversionCache = new Map();
  const observers = new Map(), pending = new Set(), boundFrames = new WeakSet();
  let language = 'zh-Hans', scheduled = false, started = false;
  const normalize = value => value === 'en' ? 'en' : value === 'zh-Hant' ? 'zh-Hant' : value === 'zh-Hans' ? 'zh-Hans' : null;
  const uiScopes = [
    '.template-studio-header', '.studio-canvas-help', '#sm-status', '#sm-project-status', '#sm-samples .sm-workbench-head', '#sm-samples .sm-panel-header', '#sm-samples .sm-toolbar',
    '#sm-samples .sm-preview-toolbar', '#sm-samples .sm-viewport-tools',
    '#sm-samples .sm-floating-dock', '#sm-samples .sm-case-panel',
    '#sm-samples > .sm-status', '#sm-samples .sm-technical',
    '.sm-template-copy-dialog', '.sm-template-background-dialog', '.sm-template-name-dialog',
    '.ox-select-menu', '.ox-calendar', '.ox-calendar-trigger', '.toast', '[data-openx-language-ui]'
  ].join(',');
  const authored = [
    '[data-openx-language-content]', '[data-language-content]', '[translate="no"]',
    '[contenteditable]:not([contenteditable="false"])', 'pre', 'code', 'script', 'style', 'textarea', 'canvas', 'svg',
    '#sm-sample-title', '#sm-sample-meta', '#sm-base-meta',
    '#sm-template-copy-template', '.sm-background-template', '#sm-image-meta',
    '#sm-placement-rows', '#sm-layout-summary', '#sm-current-analysis',
    '.sm-template-info strong', '.sm-template-placeholder strong',
    '#sm-sample-picker option', '#sm-adapt-target option', '#sm-text-layer option:not([value=""])',
    '.sm-copy-field > label:not(.sm-highlight-label)', '.sm-copy-candidate-fields label > span',
    '#sm-gen-reference-preview', '#sm-gen-result', '#sm-library-grid', '#sm-run-history', '#sm-adapt-result'
  ].join(',');
  const ruleSheets = 'main > .sheet:not(#social-media):not(#sm-library)';

  function authoredSelect(element) {
    let select = element.closest('.ox-select-wrap')?.querySelector('select');
    const menu = element.closest('.ox-select-menu');
    if (menu) select = document.querySelector('[aria-controls="' + CSS.escape(menu.id) + '"]')?.closest('.ox-select-wrap')?.querySelector('select');
    return select && ['sm-sample-picker', 'sm-adapt-target', 'sm-text-layer'].includes(select.id) ? select : null;
  }

  function textScope(element) {
    if (!element || element.closest(authored)) return false;
    if (authoredSelect(element)) return false;
    if (element.closest(uiScopes)) return true;
    return mode !== 'templates' && (element.closest('.doc-nav,.sample-toolbar') || element.closest(ruleSheets));
  }
  function attributeScope(element) {
    if (!element || element.closest('[data-openx-language-content],[data-language-content],[translate="no"],pre,code,script,style,svg')) return false;
    // Input placeholders and control labels are UI; their .value is never read or written here.
    return !!element.closest(uiScopes) || (mode !== 'templates' && !!element.closest('.doc-nav,.sample-toolbar,' + ruleSheets)) || element.id === 'sm-canvas' || element.tagName === 'IFRAME';
  }
  function convert(text) {
    if (!window.OpenXUILocale || (language !== 'en' && !/[\u3400-\u9fff]/.test(text))) return text;
    const key = language + ':' + text;
    if (conversionCache.has(key)) return conversionCache.get(key);
    const result = window.OpenXUILocale.convert(text, language);
    if (conversionCache.size >= 1024) conversionCache.delete(conversionCache.keys().next().value);
    conversionCache.set(key, result);
    return result;
  }
  // These labels contain a genuine object name between fixed UI words. Keep that name verbatim.
  function renderText(element, source, attribute) {
    if (!attribute && element.matches('.sm-field-error,.sm-copy-validation,.sm-copy-feedback,.sm-background-status,#sm-status,#sm-project-status,#sm-base-status,#sm-logo-status')) {
      const fieldError = source.match(/^([^：:\n]+)([：:])([\s\S]*)$/);
      if (fieldError && [...document.querySelectorAll('.sm-copy-field > label:not(.sm-highlight-label),#sm-text-layer option,.sm-copy-candidate-fields label > span')].some(label => label.textContent.trim() === fieldError[1].trim())) {
        return fieldError[1] + fieldError[2] + convert(fieldError[3]);
      }
    }
    if (element.id === 'sm-selection-label' && /^(已选中|已選中)[：:]/.test(source)) {
      const match = source.match(/^([^：:]+[：:])(.*)$/);
      return convert(match[1]) + (/^(底图|底圖|Logo · 位置已锁定|Logo · 位置已鎖定)$/.test(match[2]) ? convert(match[2]) : match[2]);
    }
    if (element.id === 'sm-template-current') return source.replace(/^(当前画布|當前畫布)/, value => convert(value));
    if (!attribute) return convert(source);
    if (authoredSelect(element) && element.matches('.ox-select-trigger')) {
      const comma = source.search(/[，,]/);
      return comma < 0 ? convert(source) : convert(source.slice(0, comma + 1)) + source.slice(comma + 1);
    }
    if (element.matches('.sm-template-rename')) return source.replace(/^(重命名模板|重新命名範本)/, value => convert(value));
    if (element.matches('.sm-template-retry')) return source.replace(/^(重新加载|重新載入)/, value => convert(value)).replace(/的预览$|的預覽$/, value => convert(value));
    if (element.matches('[data-sm-template]')) return source.replace(/，(?:预览未载入，仍可选择模板|預覽未載入，仍可選擇模板)$/, value => convert(value));
    if (element.matches('#sm-template-library > summary')) return source.replace(/^(当前画布|當前畫布)/, value => convert(value));
    if (element.matches('[data-sm-text-index],.sm-copy-candidate-fields textarea')) return source.replace(/^(候选|候選)/, value => convert(value));
    if (element.id === 'sm-canvas') {
      // The leading template name is source content; only its trailing accessibility description is UI.
      const match = source.match(/^(.*?，\d+×\d+，)(.*)$/);
      return match ? match[1] + convert(match[2]) : source;
    }
    return convert(source);
  }
  function updateText(node) {
    const element = node.parentElement;
    if (!textScope(element)) return;
    let record = textRecords.get(node);
    if (!record || node.data !== record.rendered) record = {source: node.data, rendered: node.data};
    else if (record.language === language) return;
    record.rendered = renderText(element, record.source);
    record.language = language;
    textRecords.set(node, record);
    if (node.data !== record.rendered) node.data = record.rendered;
  }
  function updateAttributes(element) {
    if (!attributeScope(element)) return;
    let records = attributeRecords.get(element);
    if (!records) attributeRecords.set(element, records = new Map());
    for (const attribute of attributes) {
      const current = element.getAttribute(attribute);
      if (current === null) { records.delete(attribute); continue; }
      let record = records.get(attribute);
      if (!record || current !== record.rendered) record = {source: current, rendered: current};
      else if (record.language === language) continue;
      record.rendered = renderText(element, record.source, attribute);
      record.language = language;
      records.set(attribute, record);
      if (current !== record.rendered) element.setAttribute(attribute, record.rendered);
    }
  }
  function scan(scope) {
    if (scope.nodeType === Node.TEXT_NODE) { updateText(scope); return; }
    if (!(scope instanceof Element)) return;
    updateAttributes(scope);
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) updateText(node);
      else updateAttributes(node);
    }
  }
  function queue(scope) {
    if (!scope?.isConnected) return;
    pending.add(scope);
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(flush);
  }
  function flush() {
    scheduled = false;
    // Disconnect during our own label writes so no translation can feed back into itself.
    for (const observer of observers.values()) observer.disconnect();
    for (const scope of pending) if (scope.isConnected) scan(scope);
    pending.clear();
    observeScopes();
    relayFrames();
  }
  function watch(scope, options) {
    if (!observers.has(scope)) observers.set(scope, new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'childList') {
          for (const node of record.addedNodes) queue(node);
        } else queue(record.target);
      }
      discoverScopes();
    }));
    observers.get(scope).observe(scope, options);
  }
  function observeScopes() {
    if (!document.body) return;
    // The body watcher only discovers newly mounted UI portals, never translates arbitrary body text.
    watch(document.body, {childList: true});
    const selector = mode === 'templates' ? '#sm-samples,' + uiScopes : '.doc-nav,.sample-toolbar,' + ruleSheets + ',' + uiScopes;
    document.querySelectorAll(selector).forEach(scope => watch(scope, {
      childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: attributes
    }));
  }
  function discoverScopes() {
    if (!document.body) return;
    const selector = mode === 'templates' ? '#sm-samples,' + uiScopes : '.doc-nav,.sample-toolbar,' + ruleSheets + ',' + uiScopes;
    document.querySelectorAll(selector).forEach(scope => { if (!observers.has(scope)) queue(scope); });
  }
  function relayFrames() {
    document.querySelectorAll('iframe').forEach(frame => {
      if (!boundFrames.has(frame)) {
        boundFrames.add(frame);
        frame.addEventListener('load', () => relayFrame(frame));
      }
      relayFrame(frame);
    });
  }
  function relayFrame(frame) {
    try {
      const url = new URL(frame.src, location.href);
      if (url.origin !== location.origin) return;
      // A nested sample can inherit language metadata while its authored source stays unchanged.
      if (frame.contentDocument) frame.contentDocument.documentElement.lang = language;
      frame.contentWindow?.postMessage({type: 'openx-ui-language', language}, location.origin);
    } catch { /* A not-yet-loaded frame is handled by its load event. */ }
  }
  function apply(next) {
    const valid = normalize(next);
    if (!valid) return;
    language = valid;
    root.lang = language;
    root.dataset.uiLanguage = language;
    if (!started) return;
    for (const scope of observers.keys()) if (scope !== document.body) queue(scope);
    // The title belongs to the UI, not a saved project title.
    const title = document.querySelector('head > title');
    if (title) {
      const node = title.firstChild;
      if (node?.nodeType === Node.TEXT_NODE) {
        let record = textRecords.get(node);
        if (!record || node.data !== record.rendered) record = {source: node.data, rendered: node.data};
        record.rendered = convert(record.source); textRecords.set(node, record); node.data = record.rendered;
      }
    }
    relayFrames();
  }
  function start() {
    started = true;
    observeScopes();
    for (const scope of observers.keys()) if (scope !== document.body) queue(scope);
    let saved;
    try { saved = localStorage.getItem(storageKey); } catch { /* Storage may be disabled by the browser. */ }
    apply(normalize(saved) || language);
  }
  window.addEventListener('message', event => {
    if (event.origin === location.origin && event.source === window.parent && event.data?.type === 'openx-ui-language') apply(event.data.language);
  });
  window.addEventListener('storage', event => { if (event.key === storageKey) apply(event.newValue); });
  window.OpenXWorkspaceLanguage = {apply, refresh: discoverScopes, get language() { return language; }};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true});
  else start();
})();
