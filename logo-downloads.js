/* Official source files remain unchanged; preview backgrounds never enter exports. */
(() => {
  const root = document.getElementById('logo-rules');
  if (!root || root.querySelector('.lg-asset-library')) return;
  const groups = [
    {
      title: '完整横式主 Logo',
      note: '默认使用包含细线与 ONE 的完整组合。浅底和深底优先选择对应的橙色版本。',
      primary: true,
      assets: [
        ['橙色主标 · 浅底', 'OpenX-ONE-Horizontal-OnLight.svg', 'light'],
        ['橙色主标 · 深底', 'OpenX-ONE-Horizontal-OnDark.svg', 'dark'],
        ['黑色版 · 浅底', 'OpenX-ONE-Horizontal-Black.svg', 'light'],
        ['白色版 · 深底', 'OpenX-ONE-Horizontal-White.svg', 'dark']
      ]
    },
    {
      title: '完整竖式组合',
      note: '适用于已确定使用竖式组合的窄幅版位，保留符号、字标、细线与 ONE 的原有关系。',
      shape: 'vertical',
      assets: [
        ['橙色竖式 · 深底', 'OpenX-ONE-Vertical-OnDark.svg', 'dark'],
        ['黑色竖式 · 浅底', 'OpenX-ONE-Vertical-Black.svg', 'light'],
        ['白色竖式 · 深底', 'OpenX-ONE-Vertical-White.svg', 'dark']
      ]
    },
    {
      title: 'OpenX 短版横式',
      note: '用于已有品牌上下文的既定场景。正式品牌入口、规范封面与主版位使用上方的完整主 Logo。',
      assets: [
        ['橙色短版 · 浅底', 'OpenX-Horizontal-OnLight.svg', 'light'],
        ['橙色短版 · 深底', 'OpenX-Horizontal-OnDark.svg', 'dark'],
        ['黑色短版 · 浅底', 'OpenX-Horizontal-Black.svg', 'light'],
        ['白色短版 · 深底', 'OpenX-Horizontal-White.svg', 'dark']
      ]
    },
    {
      title: '独立符号',
      note: '适用于社群头像、小尺寸图标和已有品牌上下文的版位；按实际背景选择原档。',
      shape: 'symbol',
      assets: [
        ['品牌橙符号 · 深底', 'OpenX-Mark-Orange.svg', 'dark'],
        ['黑色符号 · 浅底', 'OpenX-Mark-Black.svg', 'light'],
        ['白色符号 · 深底', 'OpenX-Mark-White.svg', 'dark']
      ]
    },
    {
      title: 'App 图标与辅助图形',
      note: 'App 图标和辅助图形保留完整原稿，按各自用途使用。',
      shape: 'symbol',
      assets: [
        ['App 图标 · 圆形', 'OpenX-AppIcon-Round.svg', 'light'],
        ['辅助图形 · 白色', 'OpenX-Auxiliary-Graphic.svg', 'dark']
      ]
    }
  ];
  const message = document.createElement('p');
  message.className = 'lg-export-status';
  message.setAttribute('role', 'status');
  message.setAttribute('aria-live', 'polite');
  root.querySelector('.lg-background-grid').after(message);
  const sources = new Map();
  async function source(path) {
    if (!sources.has(path)) {
      sources.set(path, fetch(path).then(response => {
        if (!response.ok) throw new Error('SVG 原档加载失败');
        return response.text();
      }).catch(error => { sources.delete(path); throw error; }));
    }
    return sources.get(path);
  }
  function feedback(text) { message.textContent = text; }
  function operations(file, label) {
    const bar = document.createElement('div');
    bar.className = 'lg-asset-actions';
    const path = 'assets/logo/' + file;
    const link = document.createElement('a');
    link.href = path; link.download = file; link.textContent = '下载 SVG';
    link.setAttribute('aria-label', '下载 ' + label + ' SVG'); bar.append(link);
    const png = document.createElement('button');
    png.type = 'button'; png.textContent = '透明 PNG';
    png.setAttribute('aria-label', '导出 ' + label + ' 透明 PNG');
    png.addEventListener('click', () => exportPng(path, file, png)); bar.append(png);
    const copy = document.createElement('button');
    copy.type = 'button'; copy.textContent = '复制 SVG';
    copy.setAttribute('aria-label', '复制 ' + label + ' SVG 源码');
    copy.addEventListener('click', async () => {
      copy.disabled = true;
      try { await navigator.clipboard.writeText(await source(path)); feedback('已复制 ' + label + ' 的完整 SVG 源码'); }
      catch (error) { feedback('复制未完成，请下载 SVG 原档：' + error.message); }
      finally { copy.disabled = false; }
    }); bar.append(copy); return bar;
  }
  async function exportPng(path, file, button) {
    button.disabled = true;
    let imageUrl;
    try {
      const svg = await source(path);
      const documentSvg = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
      const viewBox = documentSvg.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
      if (!viewBox || viewBox.length !== 4 || !viewBox.every(Number.isFinite) || viewBox[2] <= 0 || viewBox[3] <= 0) throw new Error('无法读取原档比例，请下载 SVG');
      imageUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      const img = new Image(); img.src = imageUrl; await img.decode();
      const width = 2048, height = Math.round(width * viewBox[3] / viewBox[2]);
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('PNG 导出失败');
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = file.replace('.svg', '-2048w.png'); a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      feedback('已导出 ' + width + '×' + height + ' PNG，透明画布、原比例和颜色均保留');
    } catch (error) { feedback(error.message); }
    finally { if (imageUrl) URL.revokeObjectURL(imageUrl); button.disabled = false; }
  }
  root.querySelectorAll('.lg-example').forEach(figure => {
    const image = figure.querySelector('.lg-lockup'), caption = figure.querySelector('figcaption');
    if (image && caption && !caption.querySelector('.lg-asset-actions')) caption.append(operations(image.getAttribute('src').split('/').at(-1), figure.querySelector('h3').textContent + '主 Logo'));
  });
  const library = document.createElement('div'); library.className = 'lg-asset-library'; library.id = 'logo-assets';
  const heading = document.createElement('h3'); heading.textContent = '全部官方标识资产';
  const note = document.createElement('p');
  note.textContent = '16 份原档：完整横式 4 款、竖式 3 款、短版横式 4 款、独立符号 3 款、App 图标与辅助图形各 1 款。SVG 可直接下载或复制；PNG 按 2048px 宽导出，保留透明画布，不包含预览底色。';
  library.append(heading, note);
  for (const group of groups) {
    const section = document.createElement('section'); section.className = 'lg-asset-group' + (group.primary ? ' lg-asset-group-primary' : '');
    const groupTitle = document.createElement('h4'); groupTitle.textContent = group.title;
    const description = document.createElement('p'); description.textContent = group.note;
    const grid = document.createElement('div'); grid.className = 'lg-asset-grid';
    for (const [label, file, background] of group.assets) {
      const card = document.createElement('figure'); card.className = 'lg-asset-card'; card.dataset.asset = file;
      const stage = document.createElement('div'); stage.className = 'lg-asset-preview lg-asset-preview-' + background + (group.shape ? ' lg-asset-preview-' + group.shape : '');
      const image = document.createElement('img'); image.src = 'assets/logo/' + file; image.alt = label; image.loading = 'lazy'; stage.append(image);
      const caption = document.createElement('figcaption');
      const name = document.createElement('strong'); name.textContent = label;
      const filename = document.createElement('code'); filename.textContent = file;
      caption.append(name, filename, operations(file, label)); card.append(stage, caption); grid.append(card);
    }
    section.append(groupTitle, description, grid); library.append(section);
  }
  const origin = document.createElement('p'); origin.className = 'lg-library-source'; origin.append('资产来源：');
  const link = document.createElement('a'); link.href = 'https://openx-one-brand.pages.dev/'; link.target = '_blank'; link.rel = 'noreferrer'; link.textContent = '官方品牌资产页';
  origin.append(link, '。Black / White 字标原档仍保留 X 的橙色细节。'); library.append(origin); message.after(library);
})();
