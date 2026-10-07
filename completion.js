(()=>{
const T=window.OPENX_TOKENS;
const frame=document.querySelector('#template-frame');
let current='overview';
const labels={overview:'数据总览',list:'记录列表',detail:'记录详情',settings:'账户设置',verification:'身份验证'};
function sampleUrl(){const theme=document.querySelector('#template-theme').value,state=current==='verification'?'&state='+document.querySelector('#template-state').value:'';return `templates.html?view=${current}&theme=${theme}${state}`;}
function update(navigate=true){const url=sampleUrl();if(navigate&&frame.getAttribute('src')!==url)frame.src=url;frame.title=`${labels[current]}页面样板`;document.querySelector('#template-open').href=url;document.querySelector('#template-state-control').hidden=current!=='verification';const width=document.querySelector('#template-width').value;frame.style.width=width==='full'?'100%':`${width}px`;}
document.querySelectorAll('[data-template]').forEach(button=>button.addEventListener('click',()=>{current=button.dataset.template;document.querySelectorAll('[data-template]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));update()}));
document.querySelector('#template-width').addEventListener('change',()=>update(false));
document.querySelector('#template-theme').addEventListener('change',()=>{update(false);frame.contentWindow.postMessage({type:'openx-spec-theme',theme:document.querySelector('#template-theme').value},location.origin)});
document.querySelector('#template-state').addEventListener('change',()=>update());
frame.addEventListener('load',()=>frame.contentWindow.postMessage({type:'openx-spec-theme',theme:document.querySelector('#template-theme').value},location.origin));
window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.type!=='openx-spec-template-theme')return;document.querySelector('#template-theme').value=event.data.theme==='dark'?'dark':'light';document.querySelector('#template-theme').dispatchEvent(new Event('input',{bubbles:true}));update(false)});
document.querySelector('#implementation-facts').innerHTML=[['版本',T.version.replace('-proposal','')],['手机 / 平板边界',`${T.layout.mobileMax+1} / ${T.layout.tabletMax+1} px`],['工作区最大宽度',`${T.layout.workspaceMax} px`],['官网 / 账户按钮',`${T.component.marketingButton.height} / ${T.component.workspaceButton.height} px`]].map(([name,value])=>`<div><span>${name}</span><strong>${value}</strong></div>`).join('');
const rows=[['工作面板页面标题','dashboardTitle','mobileTitle'],['区块标题','section','section'],['标准卡片标题','card','card'],['紧凑卡片标题','compactCard','compactCard'],['核心金额','metric','mobileMetric'],['正文 / 表格内容','body','body'],['输入内容','input','input'],['字段标签','label','label'],['账户按钮','button','button'],['官网 CTA 按钮','marketingButton','marketingButtonMobile'],['辅助文字 / 时间','caption','caption'],['品牌页主标题','marketingHero','marketingHeroMobile'],['品牌页区块标题','marketingSection','marketingSectionMobile']];
document.querySelector('#type .rules-table tbody').innerHTML=rows.map(([label,desktop,mobile])=>`<tr><td>${label}</td><td>${T.type[desktop].slice(0,2).join(' / ')}</td><td>${T.type[mobile].slice(0,2).join(' / ')}</td><td>${T.type[desktop][2]}${desktop==='metric'?' · 等宽数字':''}</td></tr>`).join('');
const chapters=[...document.querySelectorAll('main>section.sheet')];
chapters.forEach((section,index)=>{const top=section.querySelector('.sheet-top>span:last-child'),foot=section.querySelector('.sheet-foot>span:last-child');if(top)top.textContent=String(index+1).padStart(2,'0')+' — '+top.textContent.replace(/^\d+\s*[—–-]\s*/, '');if(foot)foot.textContent=String(index+1).padStart(2,'0')+' / '+String(chapters.length).padStart(2,'0')});
})();
