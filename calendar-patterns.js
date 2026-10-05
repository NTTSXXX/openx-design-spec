(() => {
 const root=document.querySelector('#calendar-patterns');if(!root)return;
 const tabs=[...root.querySelectorAll('[role=tab]')];
 function activate(tab){tabs.forEach(t=>{const active=t===tab;t.setAttribute('aria-selected',active);t.tabIndex=active?0:-1;document.getElementById(t.getAttribute('aria-controls')).hidden=!active;});window.OpenXCalendar?.refresh(root);}
 tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>activate(tab));tab.addEventListener('keydown',event=>{let next=index;if(['ArrowRight','ArrowDown'].includes(event.key))next=(index+1)%tabs.length;else if(['ArrowLeft','ArrowUp'].includes(event.key))next=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;event.preventDefault();activate(tabs[next]);tabs[next].focus();});});
 const query=matchMedia('(max-width:1100px)');const orientation=()=>root.querySelector('[role=tablist]').setAttribute('aria-orientation',query.matches?'horizontal':'vertical');query.addEventListener('change',orientation);orientation();
 document.getElementById('cp-theme').addEventListener('click',()=>{const stage=document.getElementById('cp-workbench'),dark=stage.dataset.theme!=='dark';stage.dataset.theme=dark?'dark':'light';document.getElementById('cp-theme').textContent=dark?'切换浅色':'切换深色';window.OpenXCalendar?.refresh(root);});
 const formatted=id=>document.getElementById(id).value.replaceAll('-','.');
 function values(){document.getElementById('cp-range-result').textContent=`已选范围 · ${formatted('cp-from')||'不限开始日期'} — ${formatted('cp-to')||'不限结束日期'}`;document.getElementById('cp-single-result').textContent=`已选日期 · ${formatted('cp-date')||'尚未选择'}`;document.getElementById('cp-month-result').textContent=`已选月份 · ${formatted('cp-month-value').slice(0,7)||'尚未选择'}`;}
 root.addEventListener('change',values);values();
})();
