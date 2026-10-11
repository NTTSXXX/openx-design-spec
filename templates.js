(()=>{
const query=new URLSearchParams(location.search);
const views={overview:['account.html','数据总览'],list:['account-wallet.html','记录列表',{state:'history'}],detail:['account-wallet.html','记录详情',{state:'detail',coin:'USDC',order:'experience-deposit-USDC'}],settings:['account-profile.html','账户设置'],verification:['account-verification.html','身份验证',{state:'verified'}]};
const view=Object.hasOwn(views,query.get('view'))?query.get('view'):'overview';
const [page,label,params={}]=views[view];
const frame=document.getElementById('website-sample'),toggle=document.getElementById('theme-toggle');
let theme=query.get('theme')==='dark'?'dark':'light';
function setTheme(next,notify=true,reflect=true){
 theme=next==='dark'?'dark':'light';document.documentElement.dataset.theme=theme;
 toggle.textContent=theme==='dark'?'浅色':'深色';toggle.setAttribute('aria-label',theme==='dark'?'切换浅色主题':'切换深色主题');
 const current=new URL(location.href);current.searchParams.set('theme',theme);history.replaceState(history.state,'',current);
 if(notify)frame.contentWindow.postMessage({type:'openx-spec-theme',theme},location.origin);
 if(reflect&&parent!==window)parent.postMessage({type:'openx-spec-template-theme',theme},location.origin);
}
setTheme(theme,false,false);
const target=new URL('site-components/'+page,location.href);
for(const [key,value]of Object.entries({...params,sample:'1',demo:'signedin',theme}))target.searchParams.set(key,value);
if(view==='verification'&&['verified','unstarted','reviewing','needs-info','rejected'].includes(query.get('state')))target.searchParams.set('state',query.get('state'));
frame.src=target.href;frame.title=label+' · 官网当前组件';document.title='OpenX '+label+' · 官网组件样板';document.getElementById('sample-label').textContent=label+' · 官网组件';
toggle.addEventListener('click',()=>setTheme(theme==='dark'?'light':'dark'));
frame.addEventListener('load',()=>frame.contentWindow.postMessage({type:'openx-spec-theme',theme},location.origin));
window.addEventListener('message',event=>{
 if(event.origin!==location.origin)return;
 if(event.source===frame.contentWindow&&event.data?.type==='openx-spec-theme-changed')setTheme(event.data.theme,false);
 if(event.source===parent&&event.data?.type==='openx-spec-theme')setTheme(event.data.theme,true,false);
});
})();
