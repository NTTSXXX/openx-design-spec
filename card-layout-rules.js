(() => {
  const root = document.getElementById('card-layout-rules');
  if (!root || root.dataset.clReady) return;
  root.dataset.clReady = 'true';
  const bench = root.querySelector('#cl-workbench');
  const viewport = root.querySelector('#cl-viewport');
  const tabs = Array.from(root.querySelectorAll('[data-cl-mode]'));
  const rules = {
    single: ['单个任务 · 标题与卡片共用一个容器', '单卡的宽度跟随任务', '少量会员信息上限 520px；账户设置使用 840px 页面容器。卡片填满选定容器，标题和页脚随它一起收窄，内部不再次居中。高度由内容决定。'],
    equal: ['同类内容 · 共享列宽、标题区与操作行', '同排对齐，跨排自然增高', '课程和工具等相似对象共用一套结构。每卡最小建议宽度 280px，宽度足够时 3 列，中等宽度 2 列，窄屏 1 列。同一行按最长内容决定高度，标题与动作共用网格行；不让下一行迁就上一行的高度。'],
    priority: ['不同任务 · 主栏宽，关联信息短', '主次由任务关系决定', '主任务与关联信息使用 2fr / 1fr；侧栏最低 280px，容器无法同时容纳主栏与侧栏时按阅读顺序叠放。顶部对齐，侧栏按内容自然结束，不为了等高拉出空白。'],
    media: ['图片与正文 · 对齐外框及底部操作', '同组比例一致，内容各有空间', '同一排的图片卡与文字卡共享外框高度，操作落在同一基线。图像可切换 16:9、4:3、2:1，使用 cover 保持主体比例；同组图片同时切换。正文完整呈现，窄屏转单列并恢复自然高度。']
  };
  function selectMode(mode, focus = false) {
    tabs.forEach(tab => {
      const selected = tab.dataset.clMode === mode;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      root.querySelector('#' + tab.getAttribute('aria-controls')).hidden = !selected;
      if (selected && focus) tab.focus();
    });
    root.querySelector('#cl-layout-caption').textContent = rules[mode][0];
    root.querySelector('#cl-rule-title').textContent = rules[mode][1];
    root.querySelector('#cl-rule-copy').textContent = rules[mode][2];
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectMode(tab.dataset.clMode));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      selectMode(tabs[next].dataset.clMode, true);
    });
  });
  root.querySelector('#cl-theme').addEventListener('click', event => {
    const dark = bench.dataset.theme !== 'dark';
    bench.dataset.theme = dark ? 'dark' : 'light';
    event.currentTarget.setAttribute('aria-pressed', String(dark));
    event.currentTarget.textContent = dark ? '切换为浅色' : '切换为深色';
    root.querySelectorAll('[data-cl-template]').forEach(link => { link.href = `templates.html?view=${link.dataset.clTemplate}&theme=${bench.dataset.theme}`; });
  });
  root.querySelector('#cl-width').addEventListener('click', event => {
    const narrow = viewport.classList.toggle('is-narrow');
    event.currentTarget.setAttribute('aria-pressed', String(narrow));
    event.currentTarget.textContent = narrow ? '适应容器' : '查看窄屏';
  });
  root.querySelectorAll('[data-cl-single]').forEach(button => button.addEventListener('click', () => {
    const settings = button.dataset.clSingle === 'settings';
    root.querySelectorAll('[data-cl-single]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    root.querySelector('#cl-single-page').classList.toggle('is-settings', settings);
    root.querySelector('.cl-expanded-fields').hidden = !settings;
    root.querySelector('#cl-single-limit').textContent = settings ? '上限 840px' : '上限 520px';
    root.querySelector('.cl-single-page .cl-page-heading h3').textContent = settings ? '账户设置' : '会员资料';
  }));
  root.querySelectorAll('[data-cl-ratio]').forEach(button => button.addEventListener('click', () => {
    root.querySelectorAll('[data-cl-ratio]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    root.querySelector('#cl-media-grid').style.setProperty('--cl-image-ratio', button.dataset.clRatio);
    root.querySelector('#cl-ratio-label').textContent = '图片 ' + button.textContent;
  }));
})();
