(() => {
  const chapter = document.getElementById('avatar-content-rules');
  const stage = document.getElementById('ac-workbench');
  if (!chapter || !stage) return;
  const longName = chapter.querySelector('#ac-long-name');
  const compact = chapter.querySelector('#ac-compact');
  const avatarState = chapter.querySelector('#ac-avatar-state');
  const theme = chapter.querySelector('#ac-theme');
  const status = chapter.querySelector('#ac-state-note');
  const names = chapter.querySelectorAll('.ac-demo-name');
  const fullName = chapter.querySelector('#ac-full-name-value');
  const states = ['fallback', 'loading', 'missing'];
  const stateButtons = ['查看载入状态', '查看缺图回退', '恢复默认状态'];
  const stateNotes = ['当前未设置头像，使用昵称首字符回退', '头像载入中，预留尺寸与身份文字保持不变', '头像加载失败，保留昵称与首字符回退，布局不变'];
  let stateIndex = 0;
  longName.addEventListener('change', () => {
    const name = longName.checked ? '66666.char_OpenX' : '66666.char';
    names.forEach(node => { node.textContent = name; });
    fullName.textContent = name;
    status.textContent = longName.checked ? '长昵称保持原字号，名单可省略；下方「查看完整昵称」提供完整文本' : stateNotes[stateIndex];
  });
  compact.addEventListener('change', () => {
    stage.dataset.density = compact.checked ? 'compact' : 'comfortable';
    status.textContent = compact.checked ? '名单头像改为 32px，操作仍保留 44px 点击区；内容卡保持原密度' : '名单已恢复 40px 头像与标准间距';
  });
  avatarState.addEventListener('click', () => {
    stateIndex = (stateIndex + 1) % states.length;
    stage.dataset.avatarState = states[stateIndex];
    stage.querySelectorAll('.ac-demo-avatar').forEach(node => {
      if (states[stateIndex] === 'loading') node.setAttribute('aria-busy', 'true');
      else node.removeAttribute('aria-busy');
    });
    avatarState.textContent = stateButtons[stateIndex];
    status.textContent = stateNotes[stateIndex];
  });
  theme.addEventListener('click', () => {
    const dark = stage.dataset.theme !== 'dark';
    stage.dataset.theme = dark ? 'dark' : 'light';
    theme.setAttribute('aria-pressed', String(dark));
    theme.textContent = dark ? '切换为浅色' : '切换为深色';
    stage.querySelectorAll('[data-ac-brand]').forEach(image => { image.src = dark ? 'assets/logo/OpenX-Mark-White.svg' : 'assets/logo/OpenX-Mark-Black.svg'; });
    stage.querySelectorAll('[data-ac-template]').forEach(link => { link.href = `templates.html?view=${link.dataset.acTemplate}&theme=${dark ? 'dark' : 'light'}`; });
  });
  chapter.querySelectorAll('.ac-copy-table tbody tr').forEach(row => {
    row.querySelectorAll('td').forEach((cell, index) => {
      cell.dataset.acColumn = ['避免', '采用', '写法'][index];
      if (index < 2) cell.lang = 'zh-Hant';
    });
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      stage.dataset.animationPaused = String(!entries[0].isIntersecting);
    }).observe(stage);
  }
})();
