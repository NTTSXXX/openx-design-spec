/* Same-origin adapter for the authenticated social workspace. */
(() => {
  'use strict';
  const params=new URLSearchParams(location.search),mode=params.get('workspace');
  if(!['templates','rules'].includes(mode))return;
  document.documentElement.dataset.workspaceEmbed=mode;
  let ready=false,taskId=params.get('task')||'',epoch=0,restoring=false,timer,sequence=0,snapshotFlight=null,exporting=false,readOnly=false;
  const $=id=>document.getElementById(id);
  const status=(message,error=false)=>{const element=$('sm-status');element.textContent=message;element.hidden=!message;element.dataset.error=String(error);element.dataset.feedbackSource='bridge';};
  const clearServiceStatus=()=>{if($('sm-status').dataset.feedbackSource==='bridge')status('');};
  const projectStatus=(message,error=false,source='project')=>{if(source==='service'&&!error)message='';const element=$('sm-project-status');if(source==='service'&&element.dataset.feedbackSource==='project'&&element.textContent)return;element.textContent=message;element.dataset.error=String(error);element.dataset.feedbackSource=source;};
  const notify=(type,payload={})=>{if(window.parent!==window)window.parent.postMessage({type,taskId,...payload},location.origin);};
  const references=new Map(),sentBackgrounds=new Map();
  const bounded=(promise,ms,message)=>{let timeout;return Promise.race([promise,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error(message)),ms);})]).finally(()=>clearTimeout(timeout));};
  const imageData=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('底图读取失败'));reader.readAsDataURL(blob);});
  async function hydrate(project){
    const bg=project?.background;if(!bg||bg.hidden||bg.dataUrl||!bg.url)return project;
    const url=new URL(bg.url,location.origin);if(url.origin!==location.origin||!/^\/uploads\/\d+\.(png|jpg|webp)$/.test(url.pathname))throw Error('工程底图引用不正确');
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),60000);let response;
    try{response=await fetch(url,{signal:controller.signal});if(!response.ok)throw Error('工程底图未能读取，请重试');const blob=await response.blob();if(!['image/png','image/jpeg','image/webp'].includes(blob.type)||blob.size>25*1024*1024)throw Error('工程底图格式不正确');const dataUrl=await imageData(blob);references.set(dataUrl,{url:bg.url,sha256:bg.sha256});const background={...bg,dataUrl};delete background.url;delete background.sha256;return {...project,background};}catch(error){if(controller.signal.aborted)throw Error('工程底图读取超时，请重试');throw error;}finally{clearTimeout(timeout);}
  }
  const saveDraft=requestId=>{
    if(snapshotFlight)return snapshotFlight;
    const work=(async()=>{for(let attempts=0;attempts<4;attempts++){const captured=sequence,project=await bounded(window.OpenXSocialEditor.snapshot(),12000,'读取排版超时，修改已保留，请重试');if(captured!==sequence)continue;
      const dataUrl=project.background?.dataUrl;if(dataUrl){sentBackgrounds.set(captured,dataUrl);while(sentBackgrounds.size>4)sentBackgrounds.delete(sentBackgrounds.keys().next().value);const info=references.get(dataUrl);if(info){project.background={...project.background,url:info.url,sha256:info.sha256};delete project.background.dataUrl;}}
      notify('openx-template-draft',{project,sequence:captured,requestId});return captured;
    }throw Error('保存期间仍有新的修改，输入已保留，请再次保存后继续');})();snapshotFlight=work.finally(()=>{snapshotFlight=null;});return snapshotFlight;
  };
  async function init(){
    ready=true;
    if(mode==='templates'){
      const actions=document.querySelector('.sm-workbench-head-actions')||$('sm-download').parentElement;
        const save=document.createElement('button');save.type='button';save.className='site-btn site-black';save.id='sm-save-to-task';save.textContent='采用这张图';save.onclick=()=>{if(exporting||readOnly)return;exporting=true;save.disabled=true;notify('openx-template-adopt-request');};actions.prepend(save);const back=document.createElement('button');back.type='button';back.className='site-btn site-white sm-workbench-back';back.setAttribute('aria-label','返回画布');back.title='返回画布';back.innerHTML='<svg class="sm-mobile-back-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 19-7-7 7-7M5 12h14"/></svg><span class="sm-mobile-back-label">返回画布</span>';back.onclick=()=>notify('openx-template-return');actions.prepend(back);
      $('sm-save-project').disabled=false;
      $('sm-save-project').onclick=async()=>{try{window.OpenXSocialStore.download(await window.OpenXSocialEditor.snapshot());projectStatus('');}catch(error){window.OpenXSocialEditor.revealValidationError?.();projectStatus(error.message,true);}};
      $('sm-open-project').onclick=()=>$('sm-project-file').click();$('sm-project-file').onchange=async event=>{try{const file=event.target.files[0];if(file){await window.OpenXSocialEditor.restore(await window.OpenXSocialStore.readFile(file));projectStatus('');}}catch(error){projectStatus(error.message,true);}finally{event.target.value='';}};
      document.addEventListener('social-editor:change',()=>{if(restoring||readOnly)return;sequence++;notify('openx-template-dirty',{sequence});});
      for(const type of ['input','keydown','pointerdown','pointerup','wheel'])document.addEventListener(type,()=>notify('openx-template-activity'),{capture:true,passive:true});
      const selection=()=>notify('openx-template-selection',{label:$('sm-selection-label')?.textContent||'当前模板',templateName:window.OpenXSocialEditor.copyContext?.()?.title||''});
      if($('sm-selection-label'))new MutationObserver(selection).observe($('sm-selection-label'),{childList:true,subtree:true,characterData:true});
      selection();
      document.addEventListener('social-editor:change',selection);
      document.addEventListener('social-editor:name-change',selection);
    }
    notify('openx-template-ready');
  }
  window.addEventListener('message',async event=>{
    if(event.source!==window.parent||event.origin!==location.origin||!event.data||event.data.taskId!==taskId)return;
    const data=event.data;if(!ready)return;
    if(data.type==='openx-template-action'){
      if(!window.OpenXSocialEditor?.valid())return;
      const tool=data.action==='template-copy'?window.OpenXTemplateCopy:data.action==='template-background'?window.OpenXTemplateBackground:null;
      if(tool){tool.open();const selector=data.action==='template-copy'?'.sm-template-copy-dialog .sm-copy-instructions textarea':'.sm-template-background-dialog textarea';const field=document.querySelector(selector);if(field&&typeof data.instruction==='string'&&data.instruction.trim()){
        const dialog=field.closest('dialog');let feedback=dialog.querySelector('[data-agent-prefill]');
        if(!feedback){feedback=document.createElement('p');feedback.dataset.agentPrefill='true';feedback.setAttribute('role','alert');feedback.className=data.action==='template-copy'?'sm-copy-feedback':'sm-background-status';feedback.hidden=true;field.closest('label').after(feedback);}
        const incoming=data.instruction.trim(),existing=field.value.trim(),next=!existing?incoming:existing===incoming||existing.endsWith('\n\n'+incoming)?existing:existing+'\n\n'+incoming;
        if(field.disabled||field.readOnly){feedback.hidden=false;feedback.dataset.error='true';feedback.textContent='当前要求暂不可编辑；Agent 中的输入已保留，请完成当前操作后再带入';}
        else if(field.maxLength>0&&next.length>field.maxLength){feedback.hidden=false;feedback.dataset.error='true';feedback.textContent='合并要求超过 '+field.maxLength+' 字，原有要求与 Agent 输入均已保留，请精简后再带入';}
        else{feedback.hidden=true;field.value=next;field.dispatchEvent(new Event('input',{bubbles:true}));}
      }}
      return;
    }
    if(data.type==='openx-template-flush'){clearTimeout(timer);try{const captured=await saveDraft(data.requestId);notify('openx-template-flushed',{requestId:data.requestId,sequence:captured});}catch(error){window.OpenXSocialEditor.revealValidationError?.();notify('openx-template-flushed',{requestId:data.requestId,error:error.message});}return;}
    if(data.type==='openx-template-saved'){const source=sentBackgrounds.get(data.sequence);if(source&&data.background?.url&&data.background?.sha256){references.set(source,data.background);while(references.size>4)references.delete(references.keys().next().value);}return;}
    if(data.type==='openx-template-export-complete'){exporting=false;const save=$('sm-save-to-task');if(save)save.disabled=readOnly;return;}
    if(data.type==='openx-template-status'){clearServiceStatus();projectStatus(data.feedbackOwner==='parent'?'':data.message,!!data.error,'service');return;}
    if(data.type!=='openx-template-load')return;
    const token=++epoch;restoring=true;readOnly=!!data.readOnly;
    try{if(data.templateId){await window.OpenXSocialEditor.chooseTemplate(data.templateId);}else if(data.project){const p=window.OpenXSocialStore.validate(await hydrate(data.project));await window.OpenXSocialEditor.restore(p);}else await window.OpenXSocialEditor.initialize(data.asset?data.ratio:undefined);if(token!==epoch)return;
      if(data.asset){let dataUrl=data.asset.url;const inline=typeof dataUrl==='string'&&/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(dataUrl)&&dataUrl.length<=Math.ceil(25*1024*1024/3)*4+32;if(!inline){const url=new URL(dataUrl,location.origin);if(url.origin!==location.origin||!/^\/(uploads|generated|design-tools)\//.test(url.pathname))throw Error('请选择工作台里的底图');const response=await fetch(url);if(!response.ok)throw Error('底图读取失败');const blob=await response.blob();if(!['image/png','image/jpeg','image/webp'].includes(blob.type)||blob.size>25*1024*1024)throw Error('底图需要是 25 MiB 以内的 PNG、JPG 或 WebP');dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});}if(token!==epoch)return;await window.OpenXSocialEditor.useBase({dataUrl,name:data.asset.name},data.ratio);}
      if(readOnly){$('sm-save-to-task').disabled=true;$('sm-open-project').disabled=true;document.querySelectorAll('.sm-workbench input,.sm-workbench textarea,.sm-workbench select,.sm-floating-properties input,.sm-floating-properties textarea,.sm-floating-properties select').forEach(field=>{if(!field.id.includes('zoom'))field.disabled=true;});document.querySelectorAll('.sm-preview-stage,.sm-floating-tools,.sm-floating-properties').forEach(element=>element.style.pointerEvents='none');projectStatus('当前阶段仅可查看和下载');}
      restoring=false;notify('openx-template-loaded',{templateName:window.OpenXSocialEditor.copyContext?.()?.title||''});if(data.asset&&!readOnly){sequence++;notify('openx-template-dirty',{sequence});await saveDraft();}
    }catch(error){status('载入失败：'+error.message,true);notify('openx-template-error',{message:error.message});}finally{if(token===epoch)restoring=false;}
  });
  if(document.getElementById('social-media')?.dataset.smReady==='true')init();else document.addEventListener('social-media:ready',init,{once:true});
})();
