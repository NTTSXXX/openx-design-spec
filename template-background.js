/* Same-task generation, explicit adoption, no automatic paid retries. */
(()=>{'use strict';
 const params=new URLSearchParams(location.search),task=params.get('task');
 if(params.get('workspace')!=='templates'||!task)return;
 function init(){
  const editor=window.OpenXSocialEditor;if(!editor)return;
  const dialog=document.createElement('dialog');dialog.className='sm-template-background-dialog';dialog.setAttribute('aria-labelledby','sm-background-title');
  dialog.innerHTML='<header><div><h2 id="sm-background-title">生成底图</h2><p class="sm-background-template"></p></div><button type="button" class="sm-background-close" aria-label="关闭生成底图"><svg class="lucide " data-lucide-icon="x" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M18 6 6 18" /> <path d="m6 6 12 12" /> </svg> </button></header><div class="sm-background-body"><label class="field"><span>图片模型</span><select class="sm-background-model" aria-label="图片模型"></select></label><label><span>补充画面要求</span><textarea rows="2" maxlength="2000" placeholder="可补充主体、风格或需要留白的位置"></textarea></label><div class="sm-background-actions"><button class="site-btn site-orange sm-background-generate" type="button">生成底图</button><button class="site-btn site-white sm-background-refresh" type="button">查看进度</button></div><p class="sm-background-cost">生成一张，使用当前团队生图额度</p><p class="sm-background-status" role="status" aria-live="polite"></p><div class="sm-background-images"></div></div><footer><button type="button" class="site-btn site-white sm-background-cancel">取消</button><button type="button" class="site-btn site-black sm-background-adopt" disabled>采用底图</button></footer>';
  document.body.append(dialog);const q=s=>dialog.querySelector(s),entry=document.createElement('button');entry.type='button';entry.id='sm-generate-template-background';entry.className='sm-template-background-entry';entry.setAttribute('aria-label','生成底图');entry.innerHTML='<svg class="lucide " data-lucide-icon="image-plus" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M16 5h6" /> <path d="M19 2v6" /> <path d="M21 11.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7.5" /> <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /> <circle cx="9" cy="9" r="2" /> </svg> <span class="sm-floating-tooltip">生成底图</span>';entry.title='按当前文案生成一张底图，使用团队生图额度';
  const mount=()=>{(document.querySelector('[data-template-background-tool]')||document.querySelector('.sm-preview-toolbar')).append(entry);};mount();document.addEventListener('template-floating-tools:ready',mount);
  let state=null,busy=false,checking=true,unknown=false,adopting=false,signature=null,selected=null,timer=null,trigger=entry,renderRevision=0;
  const model=q('select'),generate=q('.sm-background-generate'),refresh=q('.sm-background-refresh'),status=q('.sm-background-status'),adopt=q('.sm-background-adopt');
  let fingerprintCache=null;
  const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
  async function fingerprint(current){
   if(fingerprintCache?.signature===current.signature)return fingerprintCache.value;
   // A project snapshot uses stable layer geometry; Blob URLs and savedAt must
   // never make an unchanged, reopened canvas look like a different artwork.
   const project=await editor.snapshot();delete project.savedAt;
   if(project.background?.dataUrl){const blob=await fetch(project.background.dataUrl).then(response=>response.blob());project.background.sha256=await digest(await blob.arrayBuffer());delete project.background.dataUrl;}
   const value=await digest(new TextEncoder().encode(JSON.stringify(project)));
   if(editor.backgroundContext()?.signature!==current.signature)throw Object.assign(Error('当前画面已修改，请核对后再生成'),{status:400});
   fingerprintCache={signature:current.signature,value};return value;
  }
  async function request(method='GET',body){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),method==='POST'?270000:15000);try{const response=await fetch('/api/tasks/'+encodeURIComponent(task)+'/template-background-generation',{method,signal:controller.signal,...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});const value=await response.json();if(!response.ok)throw Object.assign(Error(value.error||'生图服务暂时不可用'),{status:response.status});return value;}catch(error){if(controller.signal.aborted)throw Error('等待超时，请查看进度；不会自动重复提交');throw error;}finally{clearTimeout(timeout);}}
  function feedback(text,error=false){status.textContent=text;status.dataset.error=String(error);}
  const pending=()=>state?.status==='preparing'||['running','remote_pending','pending_confirmation','submission_unknown'].includes(state?.job?.status);
  function unsupported(){const chosen=state?.connection?.models?.find(item=>item.id===model.value),current=editor.backgroundContext();return Array.isArray(chosen?.supportedRatios)&&!chosen.supportedRatios.includes(current?.ratio)?(chosen.label||'当前模型')+' 不支持当前 '+current?.ratio+' 比例，请切换模型':'';}
  function controls(){const current=editor.backgroundContext(),valid=editor.valid(),reason=unsupported();entry.disabled=adopting;generate.disabled=!valid||busy||checking||unknown||adopting||pending()||!!state?.readOnly||!state?.connection?.ready||!model.value||!!reason;model.disabled=busy||adopting||pending()||!!state?.readOnly;q('textarea').disabled=busy||adopting||!!state?.readOnly;refresh.disabled=checking||busy||adopting;adopt.disabled=adopting||busy||checking||unknown||!!state?.readOnly||state?.sourceCurrent===false||!selected||!valid||signature!==current?.signature;q('.sm-background-template').textContent=current?.title||'请先选择模板';generate.textContent=busy?'整理画面要求…':state?.job?'重新生成底图':'生成底图';
   if(state?.readOnly)feedback(state.readOnlyReason||'此任务当前只读');else if(reason&&!busy&&!pending())feedback(reason);else if(selected&&state?.sourceCurrent===false)feedback('任务文案已更新，候选保留供参考；请按当前文案重新生成');else if(selected&&signature!==current?.signature)feedback('当前画面已修改，候选保留供参考；请按当前画面重新生成');
  }
  async function render(value){const token=++renderRevision;state=value;const previous=model.value;model.replaceChildren();for(const item of value.connection?.models||[]){const option=document.createElement('option');option.value=item.id;option.textContent=item.label;model.append(option);}if([...model.options].some(option=>option.value===previous))model.value=previous;else{const preferred=[...model.options].find(option=>option.value==='generate_image_gpt_image_2_5_flare_high');if(preferred)model.value=preferred.value;}
   const current=editor.backgroundContext();signature=null;
   if(current&&editor.valid()&&value.canvasFingerprint&&await fingerprint(current)===value.canvasFingerprint&&token===renderRevision&&editor.backgroundContext()?.signature===current.signature)signature=current.signature;
   if(token!==renderRevision)return;
   const job=value.job,container=q('.sm-background-images');container.replaceChildren();selected=null;unknown=false;
   const labels={running:'底图正在生成，可先继续编辑',remote_pending:'服务仍在处理，可在画布中继续查询',pending_confirmation:'生图需要确认，请到画布查看',submission_unknown:'提交结果未知，请先核对 Lovart 记录，避免重复计费',complete:'底图已生成，采用后可撤销',failed:'生图失败'};
   feedback(value.status==='preparing'?'正在整理画面要求…':job?.error||labels[job?.status]||value.error||(!value.connection?.ready?value.connection?.unavailableReason||'团队生图服务尚未连接':''),value.status==='failed'||job?.status==='failed');
   let allowed=0;
   for(const asset of job?.images||[]){if(typeof asset.url!=='string'||!/^\/generated\/[a-f0-9-]{36}\/lovart_[a-f0-9]{12}\.(png|jpg|jpeg|webp)$/i.test(asset.url))continue;allowed++;const button=document.createElement('button');button.type='button';button.className='sm-background-candidate';button.setAttribute('aria-label','选择生成底图');button.disabled=true;button.setAttribute('aria-pressed','false');const img=document.createElement('img');img.alt='生成底图候选';img.style.display='none';const loading=document.createElement('span');loading.className='sm-background-preview-message';loading.textContent='正在载入预览…';button.append(img,loading);container.append(button);
    const choose=()=>{if(token!==renderRevision||button.disabled)return;selected=asset;container.querySelectorAll('button').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));controls();};button.onclick=choose;
    img.onload=()=>{if(token!==renderRevision)return;loading.remove();img.style.removeProperty('display');button.disabled=false;if(!selected)choose();};img.onerror=()=>{if(token!==renderRevision)return;button.disabled=true;img.remove();loading.textContent='预览暂不可用';feedback('底图预览未能载入，原画面已保留。请查看进度后重试',true);controls();};img.src=asset.url;
   }
   if(job?.images?.length&&!allowed)feedback('底图文件地址无效，原画面已保留。请到画布查看结果',true);
   controls();window.OpenXSelectMenu?.refresh();clearTimeout(timer);if(dialog.open&&(value.status==='preparing'||job?.status==='running'))timer=setTimeout(()=>read(false),5000);
  }
  function open(){window.OpenXTemplateFloatingTools?.close();trigger=document.activeElement instanceof HTMLElement?document.activeElement:entry;if(!dialog.open)dialog.showModal();controls();}
  function close(){if(adopting)return;dialog.close();clearTimeout(timer);window.OpenXSelectMenu?.close();trigger?.focus({preventScroll:true});}
  async function read(show=true){if(show)open();if(checking||busy)return;checking=true;controls();try{await render(await request());}catch(error){unknown=true;feedback(error.message,true);}finally{checking=false;controls();}}
  async function run(){if(generate.disabled)return;const current=editor.backgroundContext();busy=true;selected=null;controls();feedback('正在整理画面要求，原底图已保留');try{const canvasFingerprint=await fingerprint(current);if(!editor.valid()||editor.backgroundContext()?.signature!==current.signature)throw Object.assign(Error('当前画面已修改，请核对后再生成'),{status:400});await render(await request('POST',{templateId:current.templateId,texts:current.texts,layout:current.layout,canvasFingerprint,model:model.value,instructions:q('textarea').value.trim(),requestId:crypto.randomUUID()}));}catch(error){unknown=!error.status||error.status>=500;feedback(error.message,true);}finally{busy=false;controls();}}
  entry.onclick=()=>{open();read(false);};generate.onclick=run;refresh.onclick=()=>read();q('.sm-background-close').onclick=close;q('.sm-background-cancel').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});model.addEventListener('change',()=>{feedback('');controls();});
  adopt.onclick=async()=>{if(adopt.disabled)return;const asset=selected,expected=signature,requestId=state?.requestId;adopting=true;controls();try{
   // A second computer may publish/change the task while this dialog is open.
   // This read is free and never submits generation or changes the canvas.
   const latest=await request();state=latest;
   if(latest.readOnly)throw Object.assign(Error(latest.readOnlyReason||'此任务当前只读'),{status:400});
   if(latest.sourceCurrent===false)throw Object.assign(Error('任务文案已更新，原画面已保留；请按当前文案重新生成'),{status:400});
   if(latest.requestId!==requestId||!latest.job?.images?.some(item=>item.url===asset.url))throw Object.assign(Error('底图候选已更新，请查看进度后再采用'),{status:400});
   await editor.applyGeneratedBackground(asset,expected);adopting=false;close();
  }catch(error){if(!error.status||error.status>=500)unknown=true;feedback(error.message,true);}finally{adopting=false;controls();}};
  document.addEventListener('social-editor:change',controls);window.OpenXTemplateBackground={open,entry,recover:read};
  request().then(render).catch(error=>{unknown=true;feedback(error.message,true);}).finally(()=>{checking=false;controls();});
 }
 if(document.getElementById('social-media')?.dataset.smReady==='true')init();else document.addEventListener('social-media:ready',init,{once:true});
})();
