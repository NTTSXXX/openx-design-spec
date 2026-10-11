/* The workbench owns the only theme switch. Artwork and comparison swatches keep their colors. */
(()=>{'use strict';if(!new URLSearchParams(location.search).has('workspace'))return;
 const root=document.documentElement;
 const hiddenControls='#component-theme,#mf-theme,#cp-theme,#cl-theme,#ac-theme,#bc-theme,#dp-theme,#theme-toggle,.theme-toggle,.theme-switch,#template-theme';
 function apply(theme){if(!['light','dark'].includes(theme))return;root.dataset.theme=theme;root.style.colorScheme=theme;
 document.querySelectorAll('[data-theme]').forEach(el=>{if(el!==root&&!el.closest('.theme-comparison'))el.dataset.theme=theme;});
 document.querySelectorAll(hiddenControls).forEach(el=>{el.hidden=true;el.setAttribute('aria-hidden','true');});
 const templateTheme=document.querySelector('#template-theme');if(templateTheme){templateTheme.closest('label')?.setAttribute('hidden','');if(templateTheme.value!==theme){templateTheme.value=theme;templateTheme.dispatchEvent(new Event('change',{bubbles:true}));}}
 document.querySelectorAll('[data-ac-template],[data-cl-template]').forEach(link=>{const view=link.dataset.acTemplate||link.dataset.clTemplate;if(view){const url=new URL(link.href,location.href);url.searchParams.set('theme',theme);link.href=url.href;}});
 document.querySelectorAll('iframe').forEach(frame=>{try{if(frame.contentDocument){frame.contentDocument.documentElement.dataset.theme=theme;frame.contentDocument.querySelectorAll('.theme-toggle,.theme-switch').forEach(el=>el.hidden=true);}frame.contentWindow?.postMessage({type:'openx-workspace-theme',theme},location.origin);}catch{}});
 }
 window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===parent&&event.data?.type==='openx-workspace-theme')apply(event.data.theme);});
 document.addEventListener('DOMContentLoaded',()=>{apply(localStorage.getItem('openx-theme')||'light');document.querySelectorAll('iframe').forEach(frame=>frame.addEventListener('load',()=>apply(root.dataset.theme)));});
 window.addEventListener('storage',event=>{if(event.key==='openx-theme')apply(event.newValue);});
})();
