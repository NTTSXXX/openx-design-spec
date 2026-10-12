/* Contextual tools reuse the editor's original controls, listeners and undo history. */
(() => {
  'use strict';
  const enabled = new URLSearchParams(location.search).get('workspace') === 'templates';
  if (!enabled) return;
  function install() {
    const module = document.getElementById('sm-samples');
    const panel = module?.querySelector('.sm-case-panel');
    const tabs = panel?.querySelector('.sm-inspector-tabs');
    const stage = document.getElementById('sm-stage');
    const canvas = document.getElementById('sm-canvas');
    if (!module || !panel || !tabs || !stage || module.dataset.floatingTools === 'ready') return;
    module.dataset.floatingTools = 'ready';
    // One desktop action row: preserve the original controls and event handlers.
    const controls = module.querySelector('.sm-toolbar'), actions = module.querySelector('.sm-header-actions');
    const header = module.querySelector('.sm-panel-header'), more = actions?.querySelector('.sm-engineering-menu');
    const download = document.getElementById('sm-download');
    if (controls && actions) {
      controls.append(actions);
      if (header) header.hidden = true;
      const menu = more?.querySelector('.sm-engineering-actions');
      const mobileSettings = document.createElement('div');
      mobileSettings.className = 'sm-mobile-editor-settings';
      const settings = [controls.querySelector('.sm-mode-control'),module.querySelector('.sm-align-menu'),module.querySelector('.sm-snap-switch'),module.querySelector('.sm-guide-switch'),document.getElementById('sm-view-original')].filter(Boolean).map(node => {
        const marker=document.createComment('template control home');node.before(marker);return {node,marker};
      });
      if(menu)menu.append(mobileSettings);
      const fit=document.getElementById('sm-view-fit');
      if(fit){fit.setAttribute('aria-label','适应窗口');fit.innerHTML='<svg class="lucide sm-mobile-fit-icon" width="20" height="20" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg><span class="sm-mobile-fit-label">适应窗口</span>';}
      const fitActions = () => {
        if (!menu || !download) return;
        const menuWidth = controls.clientWidth + 'px';
        if (controls.style.getPropertyValue('--sm-gallery-width') !== menuWidth) controls.style.setProperty('--sm-gallery-width', menuWidth);
        const compact = controls.clientWidth < 820;
        if (compact && download.parentElement !== menu) menu.prepend(download);
        else if (!compact && download.parentElement !== actions) actions.insertBefore(download, more);
        const phone=innerWidth<=700;
        // Preview is a secondary view setting on every screen. Phone-only
        // alignment aids return to their original desktop toolbar positions.
        for(const {node,marker} of settings){const inMenu=phone||node.classList.contains('sm-mode-control');if(inMenu&&node.parentElement!==mobileSettings)mobileSettings.append(node);else if(!inMenu&&node.parentElement===mobileSettings)marker.after(node);}
        mobileSettings.hidden=false;
        controls.dataset.mobileTools=String(phone);
      };
      new ResizeObserver(fitActions).observe(controls); fitActions();
    }

    // BEGIN OFFICIAL LUCIDE ICONS (generated, ISC / Feather MIT)
    const icons = {"text":"<svg\n  class=\"lucide \" data-lucide-icon=\"type\" aria-hidden=\"true\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"20\"\n  height=\"20\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M12 4v16\" />\n  <path d=\"M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2\" />\n  <path d=\"M9 20h6\" />\n</svg>\n","base":"<svg\n  class=\"lucide \" data-lucide-icon=\"image\" aria-hidden=\"true\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"20\"\n  height=\"20\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" ry=\"2\" />\n  <circle cx=\"9\" cy=\"9\" r=\"2\" />\n  <path d=\"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21\" />\n</svg>\n","logo":"<svg\n  class=\"lucide \" data-lucide-icon=\"badge\" aria-hidden=\"true\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"20\"\n  height=\"20\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z\" />\n</svg>\n","info":"<svg\n  class=\"lucide \" data-lucide-icon=\"info\" aria-hidden=\"true\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"20\"\n  height=\"20\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <circle cx=\"12\" cy=\"12\" r=\"10\" />\n  <path d=\"M12 16v-4\" />\n  <path d=\"M12 8h.01\" />\n</svg>\n","close":"<svg\n  class=\"lucide \" data-lucide-icon=\"x\" aria-hidden=\"true\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"20\"\n  height=\"20\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M18 6 6 18\" />\n  <path d=\"m6 6 12 12\" />\n</svg>\n","undo":"<svg\n  class=\"lucide \" data-lucide-icon=\"undo-2\" aria-hidden=\"true\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"20\"\n  height=\"20\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M9 14 4 9l5-5\" />\n  <path d=\"M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11\" />\n</svg>\n","redo":"<svg\n  class=\"lucide \" data-lucide-icon=\"redo-2\" aria-hidden=\"true\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"20\"\n  height=\"20\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"m15 14 5-5-5-5\" />\n  <path d=\"M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13\" />\n</svg>\n","minus":"<svg\n  class=\"lucide \" data-lucide-icon=\"minus\" aria-hidden=\"true\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"20\"\n  height=\"20\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M5 12h14\" />\n</svg>\n","plus":"<svg\n  class=\"lucide \" data-lucide-icon=\"plus\" aria-hidden=\"true\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"20\"\n  height=\"20\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M5 12h14\" />\n  <path d=\"M12 5v14\" />\n</svg>\n","left":"<svg\n  class=\"lucide \" data-lucide-icon=\"align-horizontal-justify-start\" aria-hidden=\"true\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"20\"\n  height=\"20\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <rect width=\"6\" height=\"14\" x=\"6\" y=\"5\" rx=\"2\" />\n  <rect width=\"6\" height=\"10\" x=\"16\" y=\"7\" rx=\"2\" />\n  <path d=\"M2 2v20\" />\n</svg>\n","center":"<svg\n  class=\"lucide \" data-lucide-icon=\"align-horizontal-justify-center\" aria-hidden=\"true\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"20\"\n  height=\"20\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <rect width=\"6\" height=\"14\" x=\"2\" y=\"5\" rx=\"2\" />\n  <rect width=\"6\" height=\"10\" x=\"16\" y=\"7\" rx=\"2\" />\n  <path d=\"M12 2v20\" />\n</svg>\n","right":"<svg\n  class=\"lucide \" data-lucide-icon=\"align-horizontal-justify-end\" aria-hidden=\"true\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"20\"\n  height=\"20\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <rect width=\"6\" height=\"14\" x=\"2\" y=\"5\" rx=\"2\" />\n  <rect width=\"6\" height=\"10\" x=\"12\" y=\"7\" rx=\"2\" />\n  <path d=\"M22 2v20\" />\n</svg>\n","top":"<svg\n  class=\"lucide \" data-lucide-icon=\"align-vertical-justify-start\" aria-hidden=\"true\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"20\"\n  height=\"20\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <rect width=\"14\" height=\"6\" x=\"5\" y=\"16\" rx=\"2\" />\n  <rect width=\"10\" height=\"6\" x=\"7\" y=\"6\" rx=\"2\" />\n  <path d=\"M2 2h20\" />\n</svg>\n","middle":"<svg\n  class=\"lucide \" data-lucide-icon=\"align-vertical-justify-center\" aria-hidden=\"true\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"20\"\n  height=\"20\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <rect width=\"14\" height=\"6\" x=\"5\" y=\"16\" rx=\"2\" />\n  <rect width=\"10\" height=\"6\" x=\"7\" y=\"2\" rx=\"2\" />\n  <path d=\"M2 12h20\" />\n</svg>\n","bottom":"<svg\n  class=\"lucide \" data-lucide-icon=\"align-vertical-justify-end\" aria-hidden=\"true\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"20\"\n  height=\"20\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <rect width=\"14\" height=\"6\" x=\"5\" y=\"12\" rx=\"2\" />\n  <rect width=\"10\" height=\"6\" x=\"7\" y=\"2\" rx=\"2\" />\n  <path d=\"M2 22h20\" />\n</svg>\n","reset":"<svg\n  class=\"lucide \" data-lucide-icon=\"rotate-ccw\" aria-hidden=\"true\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"20\"\n  height=\"20\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\" />\n  <path d=\"M3 3v5h5\" />\n</svg>\n","copy":"<svg\n  class=\"lucide \" data-lucide-icon=\"notebook-pen\" aria-hidden=\"true\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"20\"\n  height=\"20\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4\" />\n  <path d=\"M2 6h4\" />\n  <path d=\"M2 10h4\" />\n  <path d=\"M2 14h4\" />\n  <path d=\"M2 18h4\" />\n  <path d=\"M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z\" />\n</svg>\n","chevron":"<svg\n  class=\"lucide \" data-lucide-icon=\"chevron-down\" aria-hidden=\"true\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"20\"\n  height=\"20\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"m6 9 6 6 6-6\" />\n</svg>\n"};
    // END OFFICIAL LUCIDE ICONS
    const names = {text: '文字', base: '底图', logo: 'Logo', info: '说明'};
    const dock = document.createElement('div');
    dock.className = 'sm-floating-dock'; dock.hidden = true;
    const toolbar = document.createElement('div');
    toolbar.className = 'sm-floating-tools';
    toolbar.setAttribute('aria-label', '画布对象工具');
    const copyHost = document.createElement('div');
    copyHost.className = 'sm-floating-tool-host';
    copyHost.setAttribute('data-template-copy-tool', '');
    const backgroundHost = document.createElement('div');
    backgroundHost.className = 'sm-floating-tool-host';
    backgroundHost.setAttribute('data-template-background-tool', '');
    toolbar.append(tabs, copyHost, backgroundHost); dock.append(toolbar); module.append(dock);
    const heading = document.createElement('div'); heading.className = 'sm-floating-panel-heading';
    const title = document.createElement('strong'); title.id = 'sm-floating-panel-title';
    const close = document.createElement('button'); close.type = 'button'; close.className = 'sm-floating-close';
    close.setAttribute('aria-label', '关闭属性');
    close.innerHTML = icons.close;
    heading.append(title, close); panel.prepend(heading);
    panel.classList.add('sm-floating-panel'); panel.setAttribute('role', 'region');
    panel.setAttribute('aria-labelledby', title.id); panel.hidden = true;
    // Keep the panel inside #social-media so the editor's existing selectors still find it.
    module.append(panel);
    let opened = null, returnFocus = null, pendingFrame = 0, gesture = false;
    const buttons = [...tabs.querySelectorAll('[data-sm-inspector]')];
    if (document.documentElement.hasAttribute('data-template-standalone')) {
      const info=document.getElementById('sm-inspector-info');
      // Keep source-case anchors for renderer updates, but do not present them
      // as an analysis of the user's current replacement artwork.
      for(const child of [...info.children])child.hidden=true;
      const help=document.createElement('dl');help.className='sm-standalone-help';
      for(const [name,description] of [
        ['文字颜色','在文字输入框中选取一段，设置局部颜色并应用。整段颜色和强调色可分别调整。'],
        ['底图尺寸','选中底图后拖动角点缩放，默认保持比例；按住 Shift 可自由调整。'],
        ['画布视图','滚动平移；Ctrl / ⌘ 加滚动缩放。空格加拖动或中键拖动也可平移。'],
        ['撤销与导出','画布聚焦时，Ctrl / ⌘ + Z 撤销，Ctrl / ⌘ + Shift + Z 重做。导出 PNG 保持作品原尺寸。']
      ]){const row=document.createElement('div'),term=document.createElement('dt'),detail=document.createElement('dd');term.textContent=name;detail.textContent=description;row.append(term,detail);help.append(row);}
      info.append(help);
    }
    const active = () => buttons.find(button => button.getAttribute('aria-selected') === 'true');
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const box = node => node?.getBoundingClientRect();
    const overlaps = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    function selectionBox() {
      const selection = box(document.querySelector('#sm-edit-overlay [data-selection]'));
      if (!selection?.width || !selection.height) return null;
      const boundary = box(stage);
      const left = Math.max(0, boundary.left, selection.left), top = Math.max(0, boundary.top, selection.top);
      const right = Math.min(innerWidth, boundary.right, selection.right), bottom = Math.min(innerHeight, boundary.bottom, selection.bottom);
      return right > left && bottom > top ? {left,top,right,bottom,width:right-left,height:bottom-top} : null;
    }
    function nearby(anchor, width, height, avoid = [], minimumTop = 12, protectedControls = []) {
      const gap = 10, edge = 12, centerX = (anchor.left + anchor.right - width) / 2, centerY = (anchor.top + anchor.bottom - height) / 2;
      const topEdge = document.documentElement.dataset.canvasViewport === 'infinite' ? Math.max(minimumTop,box(stage).top+8) : edge;
      const candidates = [[centerX,anchor.top-gap-height],[centerX,anchor.bottom+gap],[anchor.right+gap,centerY],[anchor.left-gap-width,centerY],
        [edge,anchor.top-gap-height],[innerWidth-width-edge,anchor.top-gap-height],[edge,innerHeight-height-edge],[innerWidth-width-edge,topEdge]];
      for (const item of avoid) candidates.push([item.left-gap-width,centerY],[item.right+gap,centerY]);
      for (const side of avoid) for (const item of avoid) candidates.push(
        [side.left-gap-width,item.bottom+gap],[side.right+gap,item.bottom+gap],
        [side.left-gap-width,item.top-gap-height],[side.right+gap,item.top-gap-height]);
      return candidates.map(([x,y]) => {
        const left = clamp(x,edge,innerWidth-width-edge), top = clamp(y,topEdge,innerHeight-height-edge), rect = {left,top,right:left+width,bottom:top+height};
        const selectionWeight = !document.documentElement.hasAttribute('data-template-standalone') && document.documentElement.dataset.canvasViewport === 'infinite' ? 20 : 1;
        const overlap = overlaps(rect,anchor)*selectionWeight + avoid.reduce((total,item) => total+overlaps(rect,item),0)
          + protectedControls.reduce((total,item)=>total+overlaps(rect,item)*20,0);
        const distance = Math.hypot(left+width/2-(anchor.left+anchor.right)/2,top+height/2-(anchor.top+anchor.bottom)/2);
        return {...rect,score:overlap*10000+distance};
      }).sort((a,b)=>a.score-b.score)[0];
    }
    function position() {
      if (dock.hidden) return;
      const selection = selectionBox(), anchor = selection || box(canvas);
      // A camera can move the selected object entirely out of view. Keep the
      // selection, but do not strand its controls at a viewport edge. Visibility
      // (rather than hidden) lets camera mutations restore them when it returns.
      const offscreen = document.documentElement.dataset.canvasViewport === 'infinite'
        && canvas.dataset.selectedObject !== 'none'
        && document.querySelector('#sm-edit-overlay [data-selection]') && !selection;
      const visibility = offscreen ? 'hidden' : '';
      if (panel.style.visibility !== visibility) {
        dock.style.visibility = panel.style.visibility = visibility;
        window.OpenXSelectMenu?.refresh();
      }
      if (offscreen) return;
      const scene = document.documentElement.dataset.canvasViewport === 'infinite' ? [box(canvas)] : [];
      // The workbench iframe is narrower beside its Agent. Keep contextual tools
      // clear of the camera/undo controls; standalone placement stays unchanged.
      const chrome = scene.length && !document.documentElement.hasAttribute('data-template-standalone')
        ? [...module.querySelectorAll('.sm-preview-toolbar .sm-edit-tools,.sm-preview-toolbar .sm-viewport-tools,.studio-canvas-help,.sm-status,#sm-project-status')].map(box).filter(rect=>rect.width&&rect.height) : [];
      const dockAvoid = scene.concat(chrome);
      dock.dataset.orientation = 'horizontal';
      let rect = box(toolbar), placement = nearby(anchor,rect.width,rect.height,dockAvoid);
      // A tall object often leaves a useful side gutter: turn the same toolbar,
      // rather than covering artwork or reserving an empty permanent row.
      if (overlaps(placement,anchor) > 0 || chrome.some(rect=>overlaps(placement,rect)>0)) {
        dock.dataset.orientation = 'vertical'; rect = box(toolbar);
        const vertical = nearby(anchor,rect.width,rect.height,dockAvoid);
        if (vertical.score < placement.score) placement = vertical;
        else dock.dataset.orientation = 'horizontal';
      }
      dock.style.left = placement.left+'px'; dock.style.top = placement.top+'px';
      dock.dataset.overlap = String(Math.round(overlaps(placement,anchor)));
      if (!opened) return;
      const panelTop = scene.length ? box(stage).top+76 : 12;
      panel.style.width = Math.min(320,innerWidth-24)+'px';
      panel.style.maxHeight = Math.min(520,innerHeight-panelTop-12)+'px';
      let dimensions = box(panel);
      const panelAnchor=canvas.dataset.selectedObject==='base'?box(toolbar):anchor;
      const avoid=scene.concat(chrome,canvas.dataset.selectedObject==='base'?[]:[box(toolbar)]);
      const protectedControls=chrome.length?[box(toolbar)]:[];
      let next = nearby(panelAnchor,dimensions.width,dimensions.height,avoid,panelTop,protectedControls);
      // On short desktop windows keep the selected text visible, and let the
      // inspector's existing body scroll instead of covering the edited words.
      if(canvas.dataset.selectedObject!=='base' && overlaps(next,anchor)>0){
        const room=Math.max(anchor.top-22,innerHeight-anchor.bottom-22);
        if(room>=220){
          panel.style.maxHeight=Math.min(520,room)+'px';
          dimensions=box(panel);next=nearby(panelAnchor,dimensions.width,dimensions.height,avoid,panelTop,protectedControls);
        }
      }
      panel.style.left = next.left+'px'; panel.style.top = next.top+'px';
    }
    function updateExpanded() { for (const button of buttons) button.setAttribute('aria-expanded', String(opened === button.dataset.smInspector)); }
    function hide(restore = false, all = false) {
      opened = null; panel.hidden = true; updateExpanded();
      if (all) dock.hidden = true;
      if (restore && returnFocus?.isConnected) returnFocus.focus({preventScroll: true});
    }
    function show(name, trigger) {
      opened = name; returnFocus = trigger || buttons.find(button => button.dataset.smInspector === name);
      title.textContent = names[name] + '属性'; if (name === 'info') title.textContent = '排版说明';
      window.OpenXWorkspaceLanguage?.refresh(title);
      dock.hidden = false; panel.hidden = false; updateExpanded(); position();
    }
    for (const button of buttons) {
      const name = button.dataset.smInspector;
      button.setAttribute('aria-label', names[name] + '属性');
      if (name === 'info') button.setAttribute('aria-label', '排版说明');
      button.setAttribute('aria-expanded', 'false');
      button.innerHTML = icons[name] + '<span class="sm-floating-tooltip">' + names[name] + '</span>';
      // Capture the previous open panel before the renderer changes aria-selected
      // (its observer may otherwise make the newly selected tab look like a
      // second click and immediately close it).
      button.addEventListener('click', () => opened === name ? hide() : show(name, button), true);
      button.addEventListener('keydown', event => {
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
          const selected = active(); if (selected) show(selected.dataset.smInspector, selected);
        } else if (event.key === 'Tab' && !event.shiftKey && opened) {
          event.preventDefault(); close.focus();
        }
      });
    }
    close.addEventListener('click', () => hide(true));
    close.addEventListener('keydown', event => { if (event.key === 'Tab' && event.shiftKey) { event.preventDefault(); active()?.focus(); } });
    function isOwnedPopup(target) {
      return [...panel.querySelectorAll('[aria-controls]')].some(control => document.getElementById(control.getAttribute('aria-controls'))?.contains(target));
    }
    document.addEventListener('pointerdown', event => {
      if (!panel.contains(event.target) && !toolbar.contains(event.target) && !isOwnedPopup(event.target)) hide(false,true);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !dock.hidden && (!event.defaultPrevented || event.target === canvas)) {
        event.preventDefault(); hide(false,true); canvas.focus({preventScroll:true});
        if (event.target !== canvas) canvas.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));
      }
    });
    canvas.addEventListener('pointerdown', () => { gesture = true; hide(false,true); });
    canvas.addEventListener('pointerup', event => {
      gesture = false;
      if (event.button !== 0 || stage.getAttribute('aria-busy') === 'true') return;
      const selected = active(), kind = canvas.dataset.selectedObject;
      if (kind !== 'none' && selected) {
        dock.hidden = false; position();
        if (kind === 'logo') show('logo',canvas);
      }
    });
    canvas.addEventListener('pointercancel', () => { gesture = false; hide(false,true); });
    canvas.setAttribute('aria-keyshortcuts','Enter');
    canvas.addEventListener('keydown', event => {
      if(event.key==='Enter' && event.target===canvas && stage.getAttribute('aria-busy')!=='true') {
        event.preventDefault();const name=canvas.dataset.selectedObject==='none'?'text':canvas.dataset.selectedObject;
        const button=buttons.find(item=>item.dataset.smInspector===name);if(button){if(opened===name)hide();button.click();}
      }
    });
    // Selection changes while dragging/editing synchronize the open view without reopening it.
    new MutationObserver(() => {
      if (opened && active()) { opened = active().dataset.smInspector; title.textContent = opened === 'info' ? '排版说明' : names[opened] + '属性'; window.OpenXWorkspaceLanguage?.refresh(title); updateExpanded(); }
    }).observe(tabs, {subtree: true, attributes: true, attributeFilter: ['aria-selected']});
    document.addEventListener('social-editor:selected', () => hide(false,true));
    const schedulePosition = () => { if (dock.hidden || gesture || pendingFrame) return; pendingFrame = requestAnimationFrame(() => { pendingFrame = 0; if (canvas.dataset.selectedObject === 'none') hide(false,true); else position(); }); };
    window.addEventListener('resize', schedulePosition);
    window.addEventListener('scroll', schedulePosition, {capture: true, passive: true});
    new ResizeObserver(schedulePosition).observe(toolbar);
    new ResizeObserver(schedulePosition).observe(panel);
    new MutationObserver(schedulePosition).observe(document.getElementById('sm-edit-overlay'),{childList:true,subtree:true,attributes:true});
    new MutationObserver(schedulePosition).observe(canvas,{attributes:true,attributeFilter:['data-selected-object','style']});
    function disclosure(parent,label,className) {
      const details = document.createElement('details'); details.className='sm-floating-disclosure '+className;
      const summary = document.createElement('summary'); summary.innerHTML=icons.chevron; summary.append(label);
      const body = document.createElement('div'); body.className='sm-floating-disclosure-body';
      details.append(summary,body); parent.append(details); details.addEventListener('toggle',schedulePosition); return body;
    }
    function rangeColorControl(field) {
      const textarea=field.querySelector('textarea[data-sm-text-index]');
      if(!textarea || field.querySelector('.sm-range-color'))return;
      const index=Number(textarea.dataset.smTextIndex),section=document.createElement('section');
      section.className='sm-range-color';section.setAttribute('aria-label','局部文字颜色');
      const heading=document.createElement('div'),label=document.createElement('label'),selection=document.createElement('span');
      heading.className='sm-range-color-heading';label.textContent='局部颜色';selection.className='sm-range-color-selection';
      const controls=document.createElement('div'),swatch=document.createElement('input'),hex=document.createElement('input'),apply=document.createElement('button'),reset=document.createElement('button'),feedback=document.createElement('p');
      controls.className='sm-range-color-controls';swatch.type='color';swatch.value='#ff8200';swatch.setAttribute('aria-label','所选文字颜色');
      hex.type='text';hex.id='sm-range-color-'+index;hex.value='#FF8200';hex.maxLength=7;hex.spellcheck=false;hex.autocomplete='off';hex.setAttribute('aria-label','局部颜色 HEX');label.htmlFor=hex.id;
      apply.type=reset.type='button';apply.textContent='应用';reset.textContent='重置';reset.setAttribute('aria-label','清除所选文字的局部颜色');
      feedback.className='sm-range-color-feedback';feedback.setAttribute('role','status');feedback.hidden=true;
      heading.append(label,selection);controls.append(swatch,hex,apply,reset);section.append(heading,controls,feedback);textarea.after(section);
      let selected=null,busy=false;
      const normalized=value=>{const raw=value.trim();return /^#[a-f\d]{3}$/i.test(raw)?'#'+[...raw.slice(1)].map(c=>c+c).join('').toUpperCase():/^#[a-f\d]{6}$/i.test(raw)?raw.toUpperCase():null;};
      const update=()=>{
        const active=!!selected&&!busy;
        for(const control of [swatch,hex,apply,reset])control.disabled=!active;
        selection.textContent=selected?'已选「'+textarea.value.slice(selected.start,selected.end)+'」':'在上方选中文字';
        selection.title=selection.textContent;
        apply.textContent=busy?'应用中':'应用';
      };
      const capture=()=>{
        const context=window.OpenXSocialEditor?.textColorContext?.(index),start=textarea.selectionStart,end=textarea.selectionEnd;
        if(!context||start===end){selected=null;update();return;}
        const next={templateId:context.templateId,index,start,end,content:textarea.value};
        if(!selected||selected.start!==start||selected.end!==end||selected.content!==next.content){
          selected=next;feedback.hidden=true;
          const range=context.colorRanges?.find(item=>item.start<=start&&item.end>=end);
          hex.value=normalized(range?.color||context.highlightColor||context.color||'#FF8200');swatch.value=hex.value.toLowerCase();hex.removeAttribute('aria-invalid');
        }
        update();
      };
      textarea.addEventListener('select',capture);textarea.addEventListener('pointerup',capture);textarea.addEventListener('keyup',capture);
      textarea.addEventListener('input',()=>{selected=null;feedback.hidden=true;update();});
      swatch.addEventListener('input',()=>{hex.value=swatch.value.toUpperCase();hex.removeAttribute('aria-invalid');feedback.hidden=true;});
      hex.addEventListener('input',()=>{const value=normalized(hex.value);if(value){swatch.value=value.toLowerCase();hex.removeAttribute('aria-invalid');}else hex.setAttribute('aria-invalid','true');feedback.hidden=true;});
      async function commit(clear){
        if(!selected||busy)return;
        const value=clear?null:normalized(hex.value);
        if(!clear&&!value){hex.setAttribute('aria-invalid','true');feedback.textContent='请输入有效颜色，如 #FF8200';feedback.hidden=false;hex.focus();return;}
        const request={...selected,color:value};busy=true;feedback.hidden=true;update();
        try{
          await window.OpenXSocialEditor.setTextRangeColor(request);
          // Renderer may rebuild the original fields. Return to the same field
          // and selection without carrying the operation into another object.
          const next=panel.querySelector('textarea[data-sm-text-index="'+index+'"]'),context=window.OpenXSocialEditor.textColorContext(index);
          if(next&&context.templateId===request.templateId&&next.value===request.content){
            next.focus({preventScroll:true});next.setSelectionRange(request.start,request.end);next.dispatchEvent(new Event('select'));
            const status=next.closest('.sm-copy-field')?.querySelector('.sm-range-color-feedback');
            if(status){status.textContent=clear?'所选文字已恢复原有颜色':'所选文字颜色已更新';status.hidden=false;}
          }
        }catch(error){feedback.textContent=error?.message||'颜色未更新，请重试';feedback.hidden=false;}
        finally{busy=false;update();schedulePosition();}
      }
      apply.addEventListener('click',()=>commit(false));reset.addEventListener('click',()=>commit(true));hex.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();commit(false);}});update();
    }
    function compactTextFields() {
      for (const styles of panel.querySelectorAll('.sm-text-style-grid:not([data-compact])')) {
        styles.dataset.compact='true';
        const positionFields = disclosure(styles,'位置与尺寸','sm-floating-position');
        const advanced = disclosure(styles,'更多文字设置','sm-floating-advanced');
        for (const label of [...styles.children].filter(node=>node.tagName==='LABEL')) {
          const key = label.querySelector('[data-sm-style]')?.dataset.smStyle;
          if (['x','y','maxWidth'].includes(key)) positionFields.append(label);
          else if (['family','weight','lineHeight','maxLines'].includes(key)) advanced.append(label);
        }
        const align=styles.querySelector('[data-sm-style=align]')?.closest('label'),color=styles.querySelector(':scope>.sm-color-field');
        if(align&&color)styles.insertBefore(align,color);
        // Color is a direct edit, independent of font sizing and positions.
        const emphasis=styles.querySelector('[data-sm-style=highlightColor]')?.closest('label');
        if(emphasis)styles.prepend(emphasis);
        if(color){color.firstChild.textContent='整段颜色';styles.prepend(color);}
        const field=styles.closest('.sm-copy-field');
        for (const node of [...field.children]) if (node.matches('.sm-highlight-label,[data-sm-highlight-index],.sm-cta-hint')) advanced.append(node);
        rangeColorControl(field);
      }
      refreshIcons(); schedulePosition();
    }
    const baseControls=panel.querySelector('.sm-base-controls');
    const basePosition=disclosure(baseControls,'位置','sm-floating-position');
    const baseTone=disclosure(baseControls,'色调与原图','sm-floating-advanced');
    for(const [keys,target] of [[['x','y'],basePosition],[['brightness','contrast','saturation'],baseTone]]) {
      for(const key of keys) { const input=document.getElementById('sm-base-'+key),label=baseControls.querySelector('label[for="sm-base-'+key+'"]'); if(label)target.append(label); if(input)target.append(input.closest('.sm-range-control')||input); }
    }
    const baseActions=document.createElement('div');baseActions.className='sm-floating-base-actions';
    document.getElementById('sm-inspector-base').prepend(baseActions);
    baseActions.append(document.getElementById('sm-replace-base'),document.getElementById('sm-base-remove'));
    baseTone.append(panel.querySelector('.sm-base-preview'),document.getElementById('sm-base-reset'));
    function refreshIcons() {
      const mappings = {'#sm-transform-undo':'undo','#sm-transform-redo':'redo','#sm-view-minus':'minus','#sm-view-plus':'plus',
        '[data-sm-align=left]':'left','[data-sm-align=center]':'center','[data-sm-align=right]':'right','[data-sm-align=top]':'top','[data-sm-align=middle]':'middle','[data-sm-align=bottom]':'bottom',
        '.sm-color-reset':'reset','[data-template-copy-tool]>button':'copy','[data-template-background-tool]>button':'base'};
      for(const [selector,name] of Object.entries(mappings)) for(const button of module.querySelectorAll(selector)) {
        if(button.dataset.antIcon===name)continue;button.dataset.antIcon=name;
        const tooltip=button.querySelector('.sm-floating-tooltip');button.innerHTML=icons[name];if(tooltip)button.append(tooltip);
      }
    }
    compactTextFields(); new MutationObserver(compactTextFields).observe(document.getElementById('sm-copy-fields'),{childList:true});
    new MutationObserver(refreshIcons).observe(toolbar,{childList:true,subtree:true});
    window.OpenXTemplateFloatingTools = {close: () => hide(false,true), reveal: () => { if(canvas.dataset.selectedObject !== 'none'){dock.hidden=false;position();} }, open: name => { const button = buttons.find(item => item.dataset.smInspector === name); if (button) { if (opened === name) hide(); button.click(); } }};
    document.dispatchEvent(new Event('template-floating-tools:ready'));
  }
  document.addEventListener('social-media:ready', install, {once: true});
  if (document.getElementById('social-media')?.dataset.smReady === 'true') install();
})();
