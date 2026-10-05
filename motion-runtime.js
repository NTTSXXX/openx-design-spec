(() => {
  'use strict';
  if (window.OpenXMotion) return;
  const html = document.documentElement;
  const osReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const regionSelector = '#main,#bc-records,#dp-chart-svg,#sample-tab-panel,[data-motion-scope]';
  const entrySelector = '[data-motion-enter],.motion-enter';
  const listSelector = '[data-motion-list]';
  const selectSelector = 'select,[class*="ox-select"]';
  const active = new Map();
  const pending = new Map();
  const revealWatching = new Set();
  const revealed = new WeakSet();
  const initializedRoots = new WeakSet();
  const roots = new Set();
  let frame = 0, previewReduce = html.dataset.motion === 'reduce';
  const reduced = () => osReduce.matches || html.dataset.motion === 'reduce' || previewReduce;
  const excluded = node => !(node instanceof Element) || !!node.closest(selectSelector);

  function cancel(node) {
    const animation = active.get(node);
    if (!animation) return;
    active.delete(node);
    animation.cancel();
  }
  function cancelAll() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; pending.clear();
    [...active.keys()].forEach(cancel);
  }
  function syncPreference() {
    html.dataset.motionEffective = reduced() ? 'reduce' : 'full';
    if (reduced()) cancelAll();
  }
  function enter(node, kind = 'enter', delay = 0) {
    if (excluded(node) || reduced() || document.hidden || !node.isConnected || node.closest('[hidden]') || typeof node.animate !== 'function') return;
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return;
    cancel(node);
    const rootStyle = getComputedStyle(html);
    const duration = kind === 'reveal' ? 320 : kind === 'chart'
      ? parseFloat(rootStyle.getPropertyValue('--ox-motion-feedback')) || 160
      : parseFloat(rootStyle.getPropertyValue('--ox-motion-content')) || 180;
    const distance = kind === 'reveal' ? 12 : kind === 'chart' ? 3 : 4;
    const animation = node.animate([
      { opacity: kind === 'reveal' ? 0 : kind === 'chart' ? .84 : .94, translate: `0 ${distance}px` },
      { opacity: 1, translate: '0 0' }
    ], { duration, delay: Math.min(delay, 72), easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'none' });
    active.set(node, animation);
    const release = () => { if (active.get(node) === animation) active.delete(node); };
    animation.onfinish = release; animation.oncancel = release;
  }
  function queue(node, kind = 'enter', delay = 0) {
    if (excluded(node) || reduced() || document.hidden) return;
    pending.set(node, { kind, delay });
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const next = [...pending]; pending.clear();
      for (const [element, options] of next) enter(element, options.kind, options.delay);
    });
  }
  function progress(node) {
    if (excluded(node) || !node.matches('.motion-progress[aria-valuenow]')) return;
    const value = Number(node.getAttribute('aria-valuenow'));
    const min = Number(node.getAttribute('aria-valuemin') ?? 0);
    const max = Number(node.getAttribute('aria-valuemax') ?? 100);
    if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) return;
    node.style.setProperty('--motion-progress', String(Math.min(1, Math.max(0, (value - min) / (max - min)))));
  }
  function descendants(node, selector) {
    if (!(node instanceof Element) || excluded(node)) return [];
    return [...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector)].filter(item => !excluded(item));
  }
  // The base document is visible. Only a first, observed viewport entry gets a reveal animation.
  const revealObserver = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      revealObserver.unobserve(entry.target);
      revealWatching.delete(entry.target);
      revealed.add(entry.target);
      if (!reduced() && !document.hidden) enter(entry.target, 'reveal');
    }
  }, { threshold: .12, rootMargin: '0px 0px -24px 0px' }) : null;
  function registerReveal(node) {
    if (excluded(node) || revealed.has(node) || revealWatching.has(node)) return;
    if (!revealObserver || reduced() || document.hidden) { revealed.add(node); return; }
    revealWatching.add(node);
    revealObserver.observe(node);
  }
  function newContent(node, animate = true) {
    descendants(node, '.motion-progress[aria-valuenow]').forEach(progress);
    descendants(node, '[data-motion-reveal]').forEach(registerReveal);
    if (!animate) return;
    descendants(node, entrySelector).slice(0, 8).forEach((element, i) => queue(element, 'enter', i * 16));
  }
  function mainChanged(main, nodes) {
    const hadContent = initializedRoots.has(main);
    initializedRoots.add(main);
    for (const node of nodes) {
      if (!(node instanceof Element) || excluded(node)) continue;
      newContent(node, hadContent);
      if (!hadContent) continue;
      // Only the changing task, chart or record region enters; never fade the whole workspace.
      const step = node.matches('.step-task') ? node : node.querySelector('.step-task');
      const chart = node.matches('.chart-canvas') ? node : node.querySelector('.chart-canvas');
      const records = node.matches('#records-region') ? node : node.querySelector('#records-region');
      if (step) queue(step, 'step');
      else if (chart) queue(chart, 'chart');
      else if (records) queue(records, 'list');
      else {
        const heading = node.querySelector('.page-heading');
        if (heading) queue(heading);
      }
    }
  }
  const observer = new MutationObserver(changes => {
    let removed = false;
    for (const change of changes) {
      const target = change.target instanceof Element ? change.target : change.target.parentElement;
      if (!target || excluded(target)) continue;
      if (change.type === 'attributes') {
        if (change.attributeName.startsWith('aria-value')) progress(target);
        if (change.attributeName === 'hidden' && !target.hidden && target.matches('.inline-note,.field-error,.bc-feedback,[data-motion-enter]')) queue(target);
        continue;
      }
      removed ||= change.removedNodes.length > 0;
      if (target.id === 'main') { mainChanged(target, change.addedNodes); continue; }
      const chart = target.closest('#dp-chart-svg,.chart-canvas');
      const list = target.closest('#bc-records,#records-region,[data-motion-list]');
      const tab = target.closest('#sample-tab-panel');
      if (chart) queue(chart, 'chart');
      else if (list && !list.matches(listSelector)) queue(list, 'list');
      else if (tab) queue(tab);
      if (list?.matches(listSelector)) {
        [...change.addedNodes].filter(node => node instanceof Element && !excluded(node)).slice(0, 8).forEach((node, i) => queue(node, 'list', i * 16));
      }
      for (const node of change.addedNodes) newContent(node, !chart && !list && !tab);
    }
    if (removed) {
      [...active.keys()].filter(node => !node.isConnected).forEach(cancel);
      for (const node of revealWatching) {
        if (!node.isConnected) { revealObserver?.unobserve(node); revealWatching.delete(node); }
      }
    }
  });
  function refresh(scope = document) {
    if (!(scope instanceof Element) && scope !== document) return;
    const disconnected = [...roots].filter(root => !root.isConnected);
    if (disconnected.length) {
      disconnected.forEach(root => roots.delete(root));
      observer.disconnect();
      for (const root of roots) observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-valuenow', 'aria-valuemin', 'aria-valuemax'] });
    }
    const candidates = scope === document ? [...scope.querySelectorAll(regionSelector)] : descendants(scope, regionSelector);
    for (const root of candidates) {
      if (roots.has(root) || excluded(root)) continue;
      // A parent scope already covers its descendants, avoiding duplicated mutation work.
      if ([...roots].some(parent => parent.contains(root))) continue;
      roots.add(root);
      if (root.childNodes.length) initializedRoots.add(root);
      observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-valuenow', 'aria-valuemin', 'aria-valuemax'] });
    }
    (scope === document ? [...scope.querySelectorAll('.motion-progress[aria-valuenow]')] : descendants(scope, '.motion-progress[aria-valuenow]')).forEach(progress);
    (scope === document ? [...scope.querySelectorAll('[data-motion-reveal]')] : descendants(scope, '[data-motion-reveal]')).forEach(registerReveal);
  }
  // CSS handles modern details. Older engines get an opening fade only, with immediate native close.
  const nativeDetailsMotion = CSS.supports('selector(details::details-content)');
  function onToggle(event) {
    const node = event.target;
    if (nativeDetailsMotion || excluded(node) || !node.matches('details') || !node.open) return;
    [...node.children].filter(child => child.tagName !== 'SUMMARY').slice(0, 6).forEach(child => queue(child));
  }
  function onPreference(event) {
    if (typeof event.detail?.reduce === 'boolean') previewReduce = event.detail.reduce;
    else previewReduce = html.dataset.motion === 'reduce';
    syncPreference();
  }
  function syncVisibility() {
    html.dataset.motionPaused = String(document.hidden);
    if (document.hidden) cancelAll();
  }
  html.classList.add('motion-runtime');
  syncPreference(); syncVisibility(); refresh();
  osReduce.addEventListener('change', syncPreference);
  document.addEventListener('openx:motion-preference', onPreference);
  document.addEventListener('toggle', onToggle, true);
  document.addEventListener('visibilitychange', syncVisibility);
  const preferenceObserver = new MutationObserver(() => { previewReduce = html.dataset.motion === 'reduce'; syncPreference(); });
  preferenceObserver.observe(html, { attributes: true, attributeFilter: ['data-motion'] });
  const cleanup = () => { cancelAll(); observer.disconnect(); preferenceObserver.disconnect(); revealObserver?.disconnect(); revealWatching.clear(); roots.clear(); };
  window.addEventListener('pagehide', cleanup);
  window.addEventListener('pageshow', event => { if (event.persisted) { syncPreference(); syncVisibility(); refresh(); preferenceObserver.observe(html, { attributes: true, attributeFilter: ['data-motion'] }); } });
  window.OpenXMotion = Object.freeze({ enter, refresh, get reduced() { return reduced(); } });
})();
