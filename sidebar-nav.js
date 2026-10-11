(() => {
  'use strict';
  const sidebar = document.querySelector('.doc-nav');
  const nav = sidebar?.querySelector('nav');
  const main = document.querySelector('main');
  if (!sidebar || !nav || !main) return;
  const modeButtons = [...sidebar.querySelectorAll('[data-spec-mode]')];
  const groups = [...sidebar.querySelectorAll('[data-spec-group]')];
  const anchors = [...nav.querySelectorAll('a[href^="#"]')];
  const generationRoots = new Set(['social-media', 'sm-library', 'ip-robot']);
  const rulesIds = new Set(['ip-robot-rules', 'sm-ip-assets', 'ip-robot-viewer']);
  const lastHash = { generation: '#sm-prompt-system', rules: '#palette' };
  let mode = 'generation';
  let robotRoute = false;
  let opened = false;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'sidebar-toggle';
  toggle.textContent = '社媒工作台';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'spec-sidebar');
  toggle.setAttribute('aria-label', '打开工作台导航');
  sidebar.id = 'spec-sidebar';
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  document.body.append(toggle, overlay);
  function setOpen(value, restoreFocus = true) {
    opened = value;
    sidebar.dataset.open = String(value);
    overlay.dataset.open = String(value);
    toggle.setAttribute('aria-expanded', String(value));
    toggle.setAttribute('aria-label', value ? '关闭工作台导航' : '打开工作台导航');
    toggle.textContent = value ? '×' : '社媒工作台';
    main.inert = value;
    if (!value && restoreFocus) toggle.focus();
  }
  function targetOf(hash) {
    try { return document.getElementById(decodeURIComponent(hash.replace(/^#/, ''))); }
    catch { return null; }
  }
  function modeFor(hash) {
    const id = hash.replace(/^#/, '');
    if (rulesIds.has(id) || targetOf(hash)?.closest('#ip-robot-rules,#sm-ip-assets')) return 'rules';
    const section = targetOf(hash)?.closest('main > section[id]');
    return section && !generationRoots.has(section.id) ? 'rules' : 'generation';
  }
  function active(hash) {
    const socialHash = ['#social-media', '#sm-samples', '#sm-prompt-system', '#sm-prompt-adapter'].includes(hash);
    anchors.forEach(a => {
      let selected = a.hash === hash;
      if (a.id === 'sm-nav-robot') selected = mode === 'generation' && socialHash && robotRoute;
      else if (a.hash === '#social-media') selected = mode === 'generation' && socialHash && !robotRoute;
      if (selected && !a.closest('[hidden]')) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });
  }
  function expandRules() {
    if (mode !== 'rules') return;
    main.querySelectorAll('details').forEach(details => {
      if (details.closest('#social-media,#sm-library')) return;
      const section = document.createElement('section');
      for (const attribute of details.attributes) if (attribute.name !== 'open') section.setAttribute(attribute.name, attribute.value);
      section.classList.add('rule-static-section'); section.dataset.ruleStatic = 'true';
      const summary = details.querySelector(':scope > summary');
      if (summary) {
        const heading = document.createElement('h3');
        heading.className = 'rule-static-heading';
        if (summary.id) heading.id = summary.id;
        heading.append(...summary.childNodes); summary.replaceWith(heading);
      }
      section.append(...details.childNodes); details.replaceWith(section);
    });
  }
  function applyMode(nextMode, hash) {
    mode = nextMode;
    document.body.dataset.specMode = mode;
    document.body.classList.toggle('spec-mode-generation', mode === 'generation');
    document.body.classList.toggle('spec-mode-rules', mode === 'rules');
    modeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.specMode === mode)));
    groups.forEach(group => { group.hidden = group.dataset.specGroup !== mode; });
    const targetRoot = targetOf(hash)?.closest('main > section[id]')?.id;
    const activeRoot = generationRoots.has(targetRoot) ? targetRoot : 'social-media';
    main.querySelectorAll(':scope > section[id]').forEach(section => {
      section.hidden = mode === 'generation'
        ? section.id !== activeRoot
        : ['social-media', 'sm-library'].includes(section.id);
    });
    const label = sidebar.querySelector('.wordmark span');
    if (label) label.textContent = '社媒工作台';
    expandRules();
    active(hash);
    window.dispatchEvent(new CustomEvent('spec-mode-change', { detail: { mode, hash } }));
  }
  function reveal(hash, scroll = false) {
    const nextMode = modeFor(hash);
    lastHash[nextMode] = hash;
    applyMode(nextMode, hash);
    const target = targetOf(hash);
    if (target) {
      for (let node = target; node && node !== main; node = node.parentElement) {
        if (node instanceof HTMLDetailsElement) node.open = true;
      }
      if (scroll) requestAnimationFrame(() => requestAnimationFrame(() => target.scrollIntoView({ block: 'start' })));
    }
  }
  modeButtons.forEach(button => button.addEventListener('click', () => {
    const nextMode = button.dataset.specMode;
    if (!['generation', 'rules'].includes(nextMode)) return;
    const hash = lastHash[nextMode];
    reveal(hash, true);
    if (location.hash !== hash) location.hash = hash;
    if (opened) setOpen(false);
  }));
  anchors.forEach(a => a.addEventListener('click', () => {
    robotRoute = a.id === 'sm-nav-robot';
    reveal(a.hash, true);
    if (opened) setOpen(false);
  }));
  sidebar.querySelector('.wordmark')?.addEventListener('click', () => {
    robotRoute = false;
    reveal('#sm-prompt-system', true);
    if (opened) setOpen(false);
  });
  toggle.addEventListener('click', () => setOpen(!opened));
  overlay.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && opened) setOpen(false);
    if (e.key !== 'Tab' || !opened) return;
    const items = [toggle, ...sidebar.querySelectorAll('a,button')].filter(el => el.getClientRects().length && !el.disabled);
    const first = items[0], last = items.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  matchMedia('(max-width:1000px)').addEventListener('change', () => { if (opened) setOpen(false, false); });
  window.addEventListener('hashchange', () => reveal(location.hash || '#sm-prompt-system', true));
  if (!location.hash) history.replaceState(null, '', location.pathname + location.search + '#sm-prompt-system');
  reveal(location.hash);
  const expandedObserver = new MutationObserver(expandRules);
  expandedObserver.observe(main, {childList:true,subtree:true});
  const observer = new IntersectionObserver(entries => {
    if (mode !== 'rules') return;
    const visible = entries.filter(entry => entry.isIntersecting && entry.target.getClientRects().length)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    if (visible[0]) active('#' + visible[0].target.id);
  }, { rootMargin: '-8% 0px -70% 0px' });
  document.querySelectorAll('main > section[id],#ip-robot-rules,#sm-ip-assets').forEach(section => observer.observe(section));
})();
