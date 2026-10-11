/* Template-copy requests preserve the authored canvas until explicit adoption. */
(() => {
  'use strict';
  const params=new URLSearchParams(location.search),taskId=params.get('task');
  if(params.get('workspace')!=='templates'||!taskId)return;
  function init(){
    const editor=window.OpenXSocialEditor;if(!editor)return;
    const dialog=document.createElement('dialog');dialog.className='sm-template-copy-dialog';dialog.setAttribute('aria-labelledby','sm-template-copy-title');
    dialog.innerHTML='<header><div><h2 id="sm-template-copy-title">模板文案</h2><p id="sm-template-copy-template"></p></div><button type="button" class="sm-copy-close" aria-label="关闭模板文案"><svg class="lucide " data-lucide-icon="x" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M18 6 6 18" /> <path d="m6 6 12 12" /> </svg> </button></header><div class="sm-copy-dialog-body"><label class="sm-copy-instructions">补充主题或要求<textarea rows="2" maxlength="4000" placeholder="可补充画面要表达的主题、重点或语气"></textarea></label><div class="sm-copy-generate-row"><button type="button" class="site-btn site-orange sm-copy-generate">生成文案</button><button type="button" class="site-btn site-white sm-copy-recover">查看生成进度</button></div><p class="sm-copy-cost">生成并自然润色，计入当前模型用量</p><p class="sm-copy-feedback" role="status" aria-live="polite" hidden></p><section class="sm-copy-candidate" aria-label="候选文案" hidden><div class="sm-copy-candidate-heading"><h3>候选文案</h3><span class="sm-copy-polish"></span></div><div class="sm-copy-candidate-fields"></div><p class="sm-copy-validation" role="status" aria-live="polite" hidden></p></section></div><footer><button type="button" class="site-btn site-white sm-copy-cancel">取消</button><button type="button" class="site-btn site-black sm-copy-adopt" disabled>采用文案</button></footer>';
    document.body.append(dialog);
    const entry=document.createElement('button');entry.type='button';entry.id='sm-generate-template-copy';entry.className='sm-template-copy-entry';entry.setAttribute('aria-label','生成模板文案');entry.innerHTML='<svg class="lucide " data-lucide-icon="sparkles" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" > <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" /> <path d="M20 2v4" /> <path d="M22 4h-4" /> <circle cx="4" cy="20" r="2" /> </svg> <span class="sm-floating-tooltip">生成文案</span>';entry.title='按当前模型生成并自然润色，计入模型用量';
    (document.querySelector('[data-template-copy-tool]')||document.querySelector('.sm-preview-toolbar')).append(entry);
    document.addEventListener('template-floating-tools:ready',()=>{const mount=document.querySelector('[data-template-copy-tool]');if(mount)mount.append(entry);});
    const query=s=>dialog.querySelector(s),instructions=query('textarea'),generate=query('.sm-copy-generate'),recover=query('.sm-copy-recover'),feedback=query('.sm-copy-feedback'),candidate=query('.sm-copy-candidate'),fields=query('.sm-copy-candidate-fields'),validation=query('.sm-copy-validation'),adopt=query('.sm-copy-adopt');
    let result=null,signature=null,rules=null,rulesFlight=null,flight=null,checking=true,unknown=false,validationToken=0,trigger=entry,adopting=false,recoverable=false;
    const sameTexts=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    function message(text,error=false){feedback.textContent=text;feedback.hidden=!text;feedback.dataset.error=String(error);}
    function validateMessage(text){validation.textContent=text;validation.hidden=!text;}
    async function request(url,options={},timeout=15000){
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
      try{const response=await fetch(url,{...options,signal:controller.signal}),value=await response.json();if(!response.ok)throw Object.assign(Error(value.error||'服务暂时不可用，请重试'),{status:response.status});return value;}
      catch(error){if(controller.signal.aborted)throw Error('等待超时，服务可能仍在生成；请查看进度，避免重复提交');throw error;}finally{clearTimeout(timer);}
    }
    function loadRules(){return rules?Promise.resolve(rules):rulesFlight||(rulesFlight=request('/api/template-copy-rules').then(value=>rules=value.rules||value).finally(()=>rulesFlight=null));}
    function controls(){
      const context=editor.copyContext(),ready=editor.valid();query('#sm-template-copy-template').textContent=context?.title||'请先选择模板';
      entry.disabled=!ready||adopting;generate.disabled=!ready||!!flight||checking||unknown||adopting;generate.textContent=flight?'生成与润色中…':result?'重新生成文案':'生成文案';recover.disabled=checking||!!flight||adopting;instructions.disabled=!!flight||adopting;
      query('.sm-copy-cost').textContent=result?'重新生成会再次计入当前模型用量':'生成并自然润色，计入当前模型用量';
      if(!ready||adopting)adopt.disabled=true;
      for(const input of fields.querySelectorAll('textarea'))input.disabled=!!flight||adopting;
    }
    function proposal(){return result?{templateId:result.proposal.templateId,texts:[...fields.querySelectorAll('textarea')].map(field=>({name:field.dataset.name,content:field.value}))}:null;}
    async function checkCandidate(){
      const token=++validationToken;adopt.disabled=true;if(!result)return;
      const current=editor.copyContext();if(recoverable&&editor.valid()&&current?.templateId===result.proposal.templateId&&sameTexts(current.texts,result.sourceTexts)){signature=current.signature;recoverable=false;}
      if(!current||signature!==current.signature||!editor.valid()){validateMessage('当前模板或文字已修改，候选保留供参考；重新生成后可采用');return;}
      try{await editor.validateCopyProposal(proposal(),signature);if(token!==validationToken)return;validateMessage('已按当前字体与文字区域检查');adopt.disabled=!!flight||checking||unknown||adopting;}
      catch(error){if(token===validationToken)validateMessage(error.message);}
    }
    async function showResult(value,expectedSignature){
      await loadRules();result=value;const context=editor.copyContext();recoverable=!expectedSignature;signature=expectedSignature||(context?.templateId===value.proposal.templateId&&sameTexts(context.texts,value.sourceTexts)?context.signature:null);if(signature)recoverable=false;
      candidate.hidden=false;fields.replaceChildren();query('.sm-copy-polish').textContent=value.humanizer?.status==='complete'?'自然润色已完成':'自然润色未完成 · 初稿';
      const rule=rules.templates.find(item=>item.id===value.proposal.templateId);
      const priority={title:0,support:1,question:2,eyebrow:3};
      for(const text of [...value.proposal.texts].sort((a,b)=>(priority[rule?.fields.find(field=>field.name===a.name)?.role]??4)-(priority[rule?.fields.find(field=>field.name===b.name)?.role]??4))){
        const spec=rule?.fields.find(item=>item.name===text.name),label=document.createElement('label'),heading=document.createElement('span'),input=document.createElement('textarea');heading.textContent=text.name;input.rows=text.name==='互动问题'?2:1;input.value=text.content;input.dataset.name=text.name;input.setAttribute('aria-label','候选'+text.name);if(spec)input.maxLength=spec.hardMaxChars*2;
        const count=document.createElement('small');const update=()=>{count.textContent=Array.from(input.value).length+' 字'+(spec?' · 最多 '+spec.maxLines+' 行':'');checkCandidate();};input.addEventListener('input',update);label.append(heading,input,count);fields.append(label);update();
      }
      message((value.warnings||[]).join('；'));await checkCandidate();controls();
    }
    function open(){window.OpenXTemplateFloatingTools?.close();trigger=document.activeElement instanceof HTMLElement?document.activeElement:entry;if(!dialog.open)dialog.showModal();controls();}
    function close(){if(adopting)return;dialog.close();trigger?.focus({preventScroll:true});}
    async function run(){
      open();if(flight||checking||unknown||adopting)return;
      const context=editor.copyContext();if(!context||!editor.valid()){message('请先完成当前排版修改',true);return;}
      const payload={templateId:context.templateId,texts:context.texts,layout:editor.layoutContext?.(),instructions:instructions.value.trim(),requestId:crypto.randomUUID()};
      flight=(async()=>{await loadRules();message('正在生成并润色，原稿已保留');const value=await request('/api/tasks/'+encodeURIComponent(taskId)+'/template-copy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)},270000);unknown=false;await showResult(value,context.signature);})();controls();adopt.disabled=true;
      try{await flight;}catch(error){unknown=!error.status||error.status>=500;message(error.message,true);}finally{flight=null;controls();if(result)checkCandidate();}
    }
    async function read(){
      open();if(checking||flight)return;checking=true;controls();
      try{const state=await request('/api/tasks/'+encodeURIComponent(taskId)+'/template-copy');unknown=state.status==='running';if(state.result)await showResult(state.result);else message(state.status==='running'?'仍在生成，稍后再查看进度':state.status==='failed'?(state.error||'生成未完成，原稿已保留'):'暂无已生成候选',state.status==='failed');}
      catch(error){message(error.message,true);}finally{checking=false;controls();if(result)checkCandidate();}
    }
    entry.onclick=()=>{if(result||flight||unknown)open();else run();};generate.onclick=run;recover.onclick=read;
    query('.sm-copy-close').onclick=close;query('.sm-copy-cancel').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    adopt.onclick=async()=>{if(adopt.disabled||adopting)return;adopting=true;controls();try{await editor.applyCopyProposal(proposal(),signature);result=null;candidate.hidden=true;message('已采用文案，可在排版工具栏撤销');adopting=false;close();}catch(error){validateMessage(error.message);}finally{adopting=false;controls();}};
    document.addEventListener('social-editor:change',()=>{controls();if(result)checkCandidate();});
    document.getElementById('sm-sample-picker')?.addEventListener('change',()=>{signature=null;controls();if(result)checkCandidate();});
    // The floating toolbar may move this exact entry node without replacing its handlers.
    window.OpenXTemplateCopy={open,generate:run,recover:read,entry};controls();
    const readiness=new MutationObserver(()=>{controls();if(result)checkCandidate();});readiness.observe(document.getElementById('sm-stage'),{attributes:true,attributeFilter:['aria-busy']});
    // A reload first reads the stored paid result; opening the tool must not
    // silently submit and bill a second request after an interrupted session.
    request('/api/tasks/'+encodeURIComponent(taskId)+'/template-copy').then(async state=>{unknown=state.status==='running';if(state.result)await showResult(state.result);else if(unknown)message('仍在生成，请稍后查看进度');}).catch(error=>{unknown=true;message(error.message,true);}).finally(()=>{checking=false;controls();if(result)checkCandidate();});
  }
  if(document.getElementById('social-media')?.dataset.smReady==='true')init();else document.addEventListener('social-media:ready',init,{once:true});
})();
