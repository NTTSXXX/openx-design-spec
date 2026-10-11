/* Three-language control. Values are locale IDs, never project data. */
(() => {
 const options=[['zh-Hans','简体中文'],['zh-Hant','繁體中文'],['en','English']];
 function mount(container,onChange){
  const button=document.createElement('button'),menu=document.createElement('div');
  button.type='button';button.className='openx-language-trigger';button.setAttribute('role','combobox');button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');button.setAttribute('aria-label','界面语言 / Interface language');
  menu.className='openx-language-menu';menu.setAttribute('role','listbox');menu.hidden=true;menu.id='openx-language-'+Math.random().toString(36).slice(2);button.setAttribute('aria-controls',menu.id);
  let current='zh-Hans',active=0;
  const items=options.map(([value,label],index)=>{const item=document.createElement('button');item.type='button';item.textContent=label;item.setAttribute('role','option');item.tabIndex=-1;item.addEventListener('click',()=>{onChange(value);update(value);close();});menu.append(item);return item;});
  function close(){menu.hidden=true;button.setAttribute('aria-expanded','false');button.focus({preventScroll:true});}
  function open(){menu.hidden=false;button.setAttribute('aria-expanded','true');active=Math.max(0,options.findIndex(o=>o[0]===current));items[active].focus({preventScroll:true});}
  function update(value){current=value;button.textContent=options.find(o=>o[0]===value)?.[1]||options[0][1];items.forEach((item,index)=>item.setAttribute('aria-selected',String(options[index][0]===value)));}
  button.addEventListener('click',()=>menu.hidden?open():close());
  container.addEventListener('keydown',event=>{if(event.key==='Escape'&&!menu.hidden){event.preventDefault();close();}else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();if(menu.hidden)open();else{active=event.key==='Home'?0:event.key==='End'?2:(active+(event.key==='ArrowDown'?1:2))%3;items[active].focus();}}else if(event.key==='Tab'){menu.hidden=true;button.setAttribute('aria-expanded','false');}});
  document.addEventListener('pointerdown',event=>{if(!menu.hidden&&!container.contains(event.target)){menu.hidden=true;button.setAttribute('aria-expanded','false');}});
  container.classList.add('openx-language-picker');container.append(button,menu);update(current);return {update};
 }
 window.OpenXLanguagePicker={mount};
 document.addEventListener('DOMContentLoaded',()=>{const container=document.querySelector('[data-openx-standalone-language]');if(!container)return;const picker=mount(container,value=>{try{localStorage.setItem('openx-language',value);}catch{}window.OpenXWorkspaceLanguage?.apply(value);});picker.update(localStorage.getItem('openx-language')||'zh-Hans');});
})();
