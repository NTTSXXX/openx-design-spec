/* Workspace catalog names are separate from artwork, project IDs and layers. */
(() => {
  'use strict';
  const icons = /*__LUCIDE_LIBRARY_ICONS__*/{"close":"<svg\n  class=\"lucide \" data-lucide-icon=\"x\" aria-hidden=\"true\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"20\"\n  height=\"20\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M18 6 6 18\" />\n  <path d=\"m6 6 12 12\" />\n</svg>\n","edit":"<svg\n  class=\"lucide \" data-lucide-icon=\"pencil\" aria-hidden=\"true\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"20\"\n  height=\"20\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\" />\n  <path d=\"m15 5 4 4\" />\n</svg>\n"};
  if(new URLSearchParams(location.search).get('workspace')!=='templates')return;
  async function init(){
    const editor=window.OpenXSocialEditor,library=document.getElementById('sm-template-library');
    if(!editor||!library)return;
    let loaded=false,loading=null,saving=false,target=null,trigger=null,previousName='';
    const dialog=document.createElement('dialog');dialog.className='sm-template-name-dialog';dialog.setAttribute('aria-labelledby','sm-template-name-title');
    dialog.innerHTML='<form novalidate><header><h2 id="sm-template-name-title">重命名模板</h2><button type="button" class="sm-template-name-close" aria-label="关闭重命名模板">'+icons.close+'</button></header><label for="sm-template-name-input">模板名称</label><input id="sm-template-name-input" autocomplete="off" maxlength="120" aria-describedby="sm-template-name-help sm-template-name-error"><p id="sm-template-name-help">修改模板库中的名称，已有作品内容保持不变</p><p id="sm-template-name-error" role="alert" hidden></p><button type="button" class="sm-template-name-retry" hidden>重新读取名称</button><footer><button type="button" class="site-btn site-white sm-template-name-reset">恢复默认名称</button><span></span><button type="button" class="site-btn site-white sm-template-name-cancel">取消</button><button type="submit" class="site-btn site-black">保存</button></footer></form>';
    library.append(dialog);
    const form=dialog.querySelector('form'),input=dialog.querySelector('input'),error=dialog.querySelector('[role=alert]'),retry=dialog.querySelector('.sm-template-name-retry'),submit=dialog.querySelector('[type=submit]');
    const showError=message=>{error.textContent=message;error.hidden=!message;};
    const controls=()=>{input.disabled=saving||!loaded;submit.disabled=saving||!loaded;submit.textContent=saving?'保存中…':'保存';for(const button of dialog.querySelectorAll('button:not([type=submit])'))button.disabled=saving;dialog.setAttribute('aria-busy',String(saving||!!loading));};
    async function request(url,options){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const response=await fetch(url,{...options,signal:controller.signal});const value=await response.json();if(!response.ok)throw Error(value.error||'名称未保存，请重试');return value;}catch(err){if(controller.signal.aborted)throw Error('连接超时，请重新读取名称后再重试');throw err;}finally{clearTimeout(timer);}}
    const apply=value=>{editor.setTemplateNames(value.names);for(const button of library.querySelectorAll('.sm-template-rename')){const sample=editor.templates().find(item=>item.id===button.dataset.templateId);button.setAttribute('aria-label','重命名模板 '+sample.title);}};
    async function load(){
      if(loading)return loading;
      loading=request('/api/template-names').then(value=>{apply(value);loaded=true;retry.hidden=true;showError('');if(target){const current=editor.templates().find(item=>item.id===target.id);previousName=current.title;if(!input.dataset.edited)input.value=current.title;}}).catch(err=>{loaded=false;if(dialog.open){showError(err.message);retry.hidden=false;}throw err;}).finally(()=>{loading=null;controls();});controls();return loading;
    }
    function close(){if(saving)return;dialog.close();target=null;trigger?.focus({preventScroll:true});}
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    dialog.querySelector('.sm-template-name-close').onclick=close;dialog.querySelector('.sm-template-name-cancel').onclick=close;
    dialog.querySelector('.sm-template-name-reset').onclick=()=>{input.value=target.defaultTitle;input.dataset.edited='true';input.focus();};
    input.oninput=()=>{input.dataset.edited='true';input.removeAttribute('aria-invalid');showError('');};
    retry.onclick=()=>load().then(()=>input.focus()).catch(()=>{});
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(saving||!loaded||!target)return;
      const name=input.value.trim();if(!name||Array.from(name).length>60||/[\u0000-\u001f\u007f]/.test(name)){showError('请输入 1–60 个字符的模板名称');input.setAttribute('aria-invalid','true');input.focus();return;}
      if(name===previousName){close();return;}
      const id=target.id;saving=true;showError('');controls();
      try{apply(await request('/api/template-names/'+encodeURIComponent(id),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,previousName})}));saving=false;close();}
      catch(err){loaded=false;showError(err.message);retry.hidden=false;}
      finally{saving=false;controls();}
    });
    for(const item of library.querySelectorAll('.sm-template-item')){
      const id=item.querySelector('[data-sm-template]').dataset.smTemplate,button=document.createElement('button');
      button.type='button';button.className='sm-template-rename';button.dataset.templateId=id;button.setAttribute('aria-label','重命名模板 '+editor.templates().find(item=>item.id===id).title);button.title='重命名模板';
      button.innerHTML=icons.edit;
      button.onclick=()=>{target=editor.templates().find(item=>item.id===id);trigger=button;previousName=target.title;input.value=target.title;delete input.dataset.edited;input.removeAttribute('aria-invalid');showError('');retry.hidden=true;dialog.showModal();controls();load().then(()=>{if(dialog.open){input.focus();input.select();}}).catch(()=>{});};
      item.append(button);
    }
    // Each opening reloads the shared names. A failure cannot silently overwrite them.
    library.addEventListener('toggle',()=>{if(library.open)load().catch(()=>{});});
    load().catch(()=>{});
  }
  if(document.getElementById('social-media')?.dataset.smReady==='true')init();else document.addEventListener('social-media:ready',init,{once:true});
})();
