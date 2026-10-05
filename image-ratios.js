(() => {
  function initImageRatios(module) {
    if (module.dataset.irReady === 'true') return;
    module.dataset.irReady = 'true';
    const grid = module.querySelector('.ir-grid');
    const current = module.querySelector('.ir-current');
    const controls = [...module.querySelectorAll('[data-ir-ratio]')];
    module.querySelector('.ir-controls').addEventListener('click', (event) => {
      const button = event.target.closest('[data-ir-ratio]');
      if (!button || !controls.includes(button)) return;
      grid.style.setProperty('--ir-ratio', button.dataset.irRatio);
      controls.forEach((control) => control.setAttribute('aria-pressed', String(control === button)));
      current.textContent = `当前同组比例 ${button.textContent.trim()}`;
    });
  }
  function init() { document.querySelectorAll('.ir-module').forEach(initImageRatios); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
