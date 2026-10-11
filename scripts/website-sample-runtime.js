// Imported before the real website entry. The specimen uses its own storage.
const namespace = 'openx-design-spec:website-components:';
for (const kind of ['localStorage', 'sessionStorage']) {
  let backing;
  try { backing = window[kind]; } catch { /* Storage denied: this visit remains usable. */ }
  const memory = new Map();
  const keys = () => {
    let saved = [];
    try { if (backing) saved = Array.from({ length: backing.length }, (_, i) => backing.key(i)).filter(k => k?.startsWith(namespace)); } catch {}
    return [...new Set([...saved, ...[...memory.keys()].map(key => namespace + key)])];
  };
  const isolated = {
    get length() { return keys().length; },
    key(i) { return keys()[i]?.slice(namespace.length) ?? null; },
    getItem(key) { key = String(key); if (memory.has(key)) return memory.get(key); try { return backing?.getItem(namespace + key) ?? null; } catch { return null; } },
    setItem(key, value) { key = String(key); value = String(value); memory.set(key, value); try { backing?.setItem(namespace + key, value); } catch {} },
    removeItem(key) { key = String(key); memory.delete(key); try { backing?.removeItem(namespace + key); } catch {} },
    clear() { const saved = keys(); memory.clear(); for (const key of saved) { try { backing?.removeItem(key); } catch {} } },
  };
  Object.defineProperty(window, kind, { value: isolated, configurable: true });
}

const url = new URL(location.href);
url.searchParams.set('sample', '1');
url.searchParams.set('demo', 'signedin');
url.searchParams.delete('vp');
sessionStorage.removeItem('openx-vp');
const initialTheme = url.searchParams.get('theme') === 'dark' ? 'dark' : 'light';
localStorage.setItem('openx-theme', initialTheme);
document.documentElement.dataset.theme = initialTheme;
history.replaceState(history.state, '', url);

// Only public read-only market requests are allowed in the specimen. A real
// business submission fails explicitly; it can never report a fake success.
const originalFetch = window.fetch.bind(window);
window.fetch = (resource, options) => {
  const target = new URL(resource instanceof Request ? resource.url : String(resource), location.href);
  const method = (options?.method ?? (resource instanceof Request ? resource.method : 'GET')).toUpperCase();
  if (method === 'GET' && target.origin === 'https://www.okx.com' && ['/api/v5/market/ticker', '/api/v5/public/instruments'].includes(target.pathname)) return originalFetch(resource, options);
  return Promise.reject(new Error('页面样板不提交业务资料，请前往官网完成此操作。'));
};

const bundled = new Set(['account.html', 'account-wallet.html', 'account-profile.html', 'account-security.html', 'account-prefs.html', 'account-verification.html', 'account-tier.html', 'account-benefits.html', 'account-indicators.html', 'account-exchanges.html', 'account-api.html']);
const base = new URL('./', location.href);
function adapt(scope) {
  const elements = scope instanceof Element ? [scope, ...scope.querySelectorAll('a[href], [style]')] : [...scope.querySelectorAll('a[href], [style]')];
  for (const element of elements) {
    if (element.hasAttribute('style')) {
      const current = element.getAttribute('style');
      const next = current.replace(/url\((['"]?)\/assets\//g, (_, quote) => `url(${quote}${new URL('assets/', base).href}`);
      if (current !== next) element.setAttribute('style', next);
    }
    if (!element.matches('a[href]')) continue;
    const destination = new URL(element.getAttribute('href'), location.href);
    if (destination.origin !== base.origin) continue;
    if (destination.pathname.endsWith('/')) {
      element.href = 'https://openx-one.pages.dev/' + destination.hash;
      element.target = '_blank'; element.rel = 'noopener noreferrer';
      continue;
    }
    if (!destination.pathname.endsWith('.html')) continue;
    const name = destination.pathname.split('/').pop();
    if (bundled.has(name)) {
      destination.searchParams.set('sample', '1');
      destination.searchParams.set('demo', 'signedin');
      destination.searchParams.set('theme', document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
      const next = destination.href;
      if (element.href !== next) element.href = next;
    } else {
      const target = new URL(name + destination.search + destination.hash, 'https://openx-one.pages.dev/');
      element.href = target.href;
      element.target = '_blank';
      element.rel = 'noopener noreferrer';
    }
  }
}
new MutationObserver(records => {
  for (const record of records) {
    if (record.type === 'attributes') adapt(record.target);
    else for (const node of record.addedNodes) if (node instanceof Element) adapt(node);
  }
}).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['href', 'style'] });

document.addEventListener('click', event => {
  const link = event.target.closest?.('a[href]');
  if (link) adapt(link);
}, true);
let applyingParentTheme = false;
window.addEventListener('message', event => {
  if (event.source !== parent || event.origin !== location.origin || event.data?.type !== 'openx-spec-theme') return;
  const theme = event.data.theme === 'dark' ? 'dark' : 'light';
  applyingParentTheme = true;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('openx-theme', theme);
  const current = new URL(location.href); current.searchParams.set('theme', theme);
  history.replaceState(history.state, '', current);
  document.querySelectorAll('img[src*="footer-logo"]').forEach(image => image.src = theme === 'light' ? 'assets/footer-logo-light.svg' : 'assets/footer-logo.svg');
  adapt(document);
  queueMicrotask(() => { applyingParentTheme = false; });
});
new MutationObserver(() => {
  if (applyingParentTheme || document.readyState !== 'complete') return;
  parent.postMessage({ type: 'openx-spec-theme-changed', theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light' }, location.origin);
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
