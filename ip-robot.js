(() => {
  'use strict';
  const root = document.getElementById('ip-robot');
  if (!root) return;
  const status = document.getElementById('ip-robot-status');
  async function copy(text, button) {
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else {
        const field = document.createElement('textarea');
        field.value = text; field.style.position = 'fixed'; field.style.opacity = '0';
        document.body.append(field); field.select();
        const copied = document.execCommand('copy'); field.remove();
        if (!copied) throw new Error('请展开Prompt后手动复制');
      }
      status.textContent = '已复制机器人Prompt'; status.dataset.error = 'false';
      const label = button.dataset.originalLabel || button.textContent;
      button.dataset.originalLabel = label; button.textContent = '已复制';
      clearTimeout(button.copyReset); button.copyReset = setTimeout(() => { button.textContent = label; }, 1600);
    } catch (error) { status.textContent = '复制未完成：' + error.message; status.dataset.error = 'true'; }
  }
  root.querySelectorAll('[data-sm-copy="ip"], [data-sm-variant-copy]').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.dataset.smVariantCopy || 'sm-ip-prompt-text';
      const prompt = document.getElementById(id);
      if (prompt) copy(prompt.textContent, button);
    });
  });
  function revealHash() {
    let id; try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target || !root.contains(target)) return;
    for (let node = target; node && node !== root; node = node.parentElement) if (node.tagName === 'DETAILS') node.open = true;
    requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
  }
  window.addEventListener('hashchange', revealHash);
  // The social panels above us settle asynchronously after images and fonts load.
  // Reposition initial deep links after that layout is ready, without a timer.
  document.addEventListener('social-media:ready', revealHash, { once: true });
  revealHash();
})();
