/* Creation flow: original references -> Lovart -> generated library -> editable layout. */
(() => {
  'use strict';
  if(new URLSearchParams(location.search).has('workspace'))return;
  const $ = id => document.getElementById(id);
  const modelNames = {image2:'Image 2','image2.5':'Image 2.5','nano-banana-pro':'Nano Banana Pro'};
  const readData = blob => new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('图片读取失败'));reader.readAsDataURL(blob);});
  const state = {references:[],service:null,job:null,busy:false,result:null,request:0,projectBusy:false,saveTimer:null,saveSequence:0};
  const editor = () => window.OpenXSocialEditor;
  const store = () => window.OpenXSocialStore;
  function message(id,text,error=false){const el=$(id);if(el){el.textContent=text;el.dataset.error=String(error);}}
  function generation(){return Object.fromEntries(['prompt','ratio','style','topic','composition','model'].map(key=>[key,$('sm-gen-'+key)?.value||'']));}
  function restoreGeneration(value={}){for(const [key,text] of Object.entries(value)){const el=$('sm-gen-'+key);if(el)el.value=text;}updatePromptNotice();}
  function buildPrompt(){
    const g=generation(),photo=g.style==='photo',robot=g.style==='robot';
    const topic=g.topic.trim().replace(/Open\s?X(?:\s+ONE)?/gi,'').trim();
    if(!topic)throw Error('先描述画面要表现的主体与动作，例如：机器人斜向飞行，带着一张行情图标卡');
    const composition={right:'主体组占画面右侧约55%–65%，以斜向前后关系组织。左侧约30%–35%为连续低对比背景，供后期标题；不要硬切色块。',bottom:'主体从上方延伸至画面约76%–80%，脸部或关键物件在上半部；下方只留够紧凑文字组的区域，背景自然连续，不留大片空洞。',center:'主视觉占中部约55%–65%，上方仅留品牌行空间，下方留紧凑标题与简介区；用近大远小和倾斜角度形成视觉重点。'}[g.composition];
    const subject=robot?'依据所附原始角色视图保持球形白壳、黑玻璃椭圆面罩、两只白色椭圆眼、细天线、橙色关节、短翼臂及胸前已有标记；翼臂自然连接、不夹持承重、不穿插。可配1件实体道具或最多1–2张相关icon卡片，不混用成堆道具。':'';
    const refs=state.references.map((r,i)=>`参考${i+1}仅用于${{subject:'主体身份与结构',composition:'构图关系',style:'材质与光照'}[r.role]}`).join('；');
    $('sm-gen-prompt').value=[
      `主体与动作：${topic}。${subject}只表现一个清晰主题，主体完整、关键轮廓不裁切。`,
      `构图：画幅${g.ratio}。${composition}主体要足够大，留白服务于文字位置。`,
      photo?'颜色与材质：自然肤色、真实衣物与环境材质，暖冷平衡；不全图染橙、不使用塑料皮肤。':'颜色与材质：黑、白和中性灰为主，#FF8200橙色仅用于重点；光滑镀银、烤漆与黑玻璃。无拉丝、刮痕、粗糙颗粒或斑驳。',
      photo?'背景与光照：柔和自然光，面部清晰；文字区与室内同色系自然衔接，保留真实环境，不用生硬渐黑面板。':'背景与光照：近黑到深灰的干净摄影棚，左上柔光，克制的高光和反射；光滑无纹理地面，柔和接触阴影。',
      `视觉效果：完整底图一次生成，光照、阴影、透明与景深统一。${robot?'动态可用10–15°机身倾斜、前后尺度差、一道沿飞行方向的短橙色拖影；面部和胸前标记保持清晰。':'保留真实空间层次，不用无意义的光带、粒子或装饰填空。'}${refs?refs+'。':''}`,
      '留白与限制：不生成标题、正文、slogan、独立Logo、水印、占位框或辅助线；文字和正式Logo后期叠加。只使用原始照片或官方角色原档作为像素参考，不把生成结果作为下一次参考。'
    ].join('\n\n');
    updatePromptNotice();message('sm-gen-status','提示词已按视觉框架整理，可直接修改后生成');queueSave();
  }
  function updatePromptNotice(){const g=generation();if(/Open\s?X/i.test(g.prompt))message('sm-gen-status','建议将品牌名称改为明确的形状、配色、材质和构图描述');}
  function busy(value){
    state.busy=value;$('sm-gen-run').disabled=value||!state.service?.available;$('sm-gen-run').textContent=value?'正在生成…':'生成底图';$('sm-gen-cancel').hidden=!value;
    for(const id of ['sm-gen-model','sm-gen-ratio','sm-gen-reference','sm-gen-build'])$(id).disabled=value;
    $('sm-gen-reference-drop').setAttribute('aria-disabled',String(value));$('sm-prompt-system').setAttribute('aria-busy',String(value));
  }
  async function refreshService(){
    try{const response=await fetch('/api/image-generation/status');if(!response.ok)throw Error('Lovart 接入服务尚未启动');state.service=await response.json();
      message('sm-gen-service',state.service.available?'Lovart 已连接'+(state.service.selectionMode==='preference'?' · 模型按偏好提交，平台可能调度其他模型':''):(state.service.message||'Lovart 待连接，请配置团队接入凭据'));
    }catch(error){state.service={available:false};message('sm-gen-service',error.message);}
    busy(state.busy);
  }
  function showReferences(){
    const list=$('sm-gen-reference-preview');list.replaceChildren();list.hidden=!state.references.length;$('sm-gen-reference-clear').hidden=!state.references.length;
    state.references.forEach((ref,index)=>{const item=document.createElement('div');item.className='sm-reference-item';const img=new Image();img.src=ref.dataUrl;img.alt=ref.name;const text=document.createElement('span');text.textContent=(index+1)+'. '+ref.name;const select=document.createElement('select');select.setAttribute('aria-label',ref.name+'的引用用途');for(const [value,title] of [['subject','主体原档'],['composition','构图参考'],['style','风格参考']])select.append(new Option(title,value));select.value=ref.role;select.disabled=state.busy;select.onchange=()=>{ref.role=select.value;message('sm-gen-status','引用用途已更新；如需写入提示词，请重新整理提示词');};const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','移除'+ref.name);remove.disabled=state.busy;remove.onclick=()=>{state.references.splice(index,1);showReferences();};item.append(img,text,select,remove);list.append(item);});
  }
  async function addReferences(files){
    if(state.busy)return;const pending=Array.from(files||[]);if(!pending.length)return;
    try{
      if(state.references.length+pending.length>10)throw Error('最多添加10张原始参考图');
      const next=[];
      for(const file of pending){if(!['image/png','image/jpeg'].includes(file.type))throw Error('Lovart 参考图请选择 JPG 或 PNG');if(file.size>8*1024*1024)throw Error(file.name+'超过8MB');const dataUrl=await readData(file);const img=new Image();img.src=dataUrl;await img.decode();next.push({name:file.name,dataUrl,role:'subject',source:'original',size:file.size});}
      if([...state.references,...next].reduce((n,r)=>n+r.size,0)>24*1024*1024)throw Error('参考图总大小不能超过24MB');
      state.references.push(...next);showReferences();message('sm-gen-status',`已加入${state.references.length}张原始参考图；请选择各图引用用途`);
    }catch(error){message('sm-gen-status',error.message,true);}finally{$('sm-gen-reference').value='';}
  }
  async function cancelGeneration(){
    const id=state.job;if(!id)return;const button=$('sm-gen-cancel');button.disabled=true;
    try{const response=await fetch('/api/image-generation/jobs/'+encodeURIComponent(id),{method:'DELETE'});const value=await response.json();if(!response.ok)throw Error(value.error?.message||value.message||'取消失败');state.request++;state.job=null;busy(false);showReferences();message('sm-gen-status',value.message||'已停止等待；Lovart 任务可能仍在执行，可在平台查看结果');}
    catch(error){message('sm-gen-status',error.message,true);}finally{button.disabled=false;}
  }
  async function generate(){
    if(state.busy)return;if(!state.service?.available){await refreshService();if(!state.service?.available)return;}
    if(!$('sm-gen-prompt').value.trim()){try{buildPrompt();}catch(error){message('sm-gen-status',error.message,true);$('sm-gen-topic').focus();return;}}
    const g=generation(),token=++state.request;
    if(!g.prompt.trim()||g.prompt.length>10000){message('sm-gen-status','提示词需为1–10000字',true);return;}
    if(g.style==='robot'&&!state.references.length){message('sm-gen-status','机器人创作请先加入官方角色原档，保持角色与胸前标记一致',true);$('sm-gen-reference').focus();return;}
    busy(true);showReferences();message('sm-gen-status','正在提交到 Lovart…');
    try{
      const response=await fetch('/api/image-generation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:g.model,prompt:g.prompt,ratio:g.ratio,references:state.references.map(({size,...ref})=>ref)})});
      let task;try{task=await response.json();}catch{throw Error('生成服务返回异常，请重试');}if(!response.ok)throw Error(task.error?.message||task.message||'提交生成任务失败');
      state.job=task.jobId;if(!state.job)throw Error('生成服务未返回任务编号');
      while(token===state.request){
        const response=await fetch('/api/image-generation/jobs/'+encodeURIComponent(state.job));const task=await response.json();if(!response.ok)throw Error(task.error?.message||task.message||'读取任务状态失败');
        if(task.status==='completed'){
          const result=task.result;const sources=Array.isArray(result?.images)?result.images:[result];const outputs=[];
          for(const item of sources){const url=typeof item==='string'?item:item?.dataUrl;if(!url)continue;const dataUrl=url.startsWith('data:')?url:await fetch(url).then(r=>{if(!r.ok)throw Error('读取结果图片失败');return r.blob();}).then(readData);const img=new Image();img.src=dataUrl;await img.decode();const asset={dataUrl,name:'创作-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+(outputs.length+1)+'.png',prompt:g.prompt,model:result.actualModel||result.model||g.model,ratio:g.ratio,source:'generated',createdAt:new Date().toISOString()};outputs.push(asset);}
          if(!outputs.length)throw Error('Lovart 任务完成，但没有可用的图片结果');
          state.result=outputs[0];showResult(state.result);let saved=0;
          for(const asset of outputs){try{const stored=await store().addAsset(asset);if(asset===state.result)state.result=stored;saved++;}catch{}}
          await renderLibrary();message('sm-gen-status',`已生成${outputs.length}张图片，${saved===outputs.length?'已存入素材库':'素材库存储不足，请立即下载保存'}${result.actualModel?' · 实际模型 '+result.actualModel:' · 平台未报告实际模型'}${result.warnings?.length?' · '+result.warnings.join('；'):''}`,saved!==outputs.length);break;
        }
        if(['failed','canceled','cancelled'].includes(task.status))throw Error(task.error?.message||task.message||'生成未完成，请调整后重试');
        message('sm-gen-status',task.message||(task.status==='queued'?'任务已排队，完成后自动存入素材库':'Lovart 正在生成，完成后自动显示结果'));await new Promise(resolve=>setTimeout(resolve,1800));
      }
    }catch(error){if(token===state.request)message('sm-gen-status',error.message,true);}finally{if(token===state.request){state.job=null;busy(false);showReferences();}}
  }
  function showResult(asset){$('sm-gen-result').hidden=false;$('sm-gen-image').src=asset.dataUrl;$('sm-gen-image').alt=asset.name;$('sm-gen-download').href=asset.dataUrl;$('sm-gen-download').download=asset.name;const empty=$('sm-gen-empty');if(empty)empty.hidden=true;}
  async function useAsset(asset){try{message('sm-gen-status','正在放入编辑器…');await editor().useBase(asset,asset.ratio);message('sm-gen-status','底图已放入模板，可继续改字与调色');}catch(error){message('sm-gen-status',error.message,true);message('sm-library-status',error.message,true);}}
  function downloadAsset(asset){const link=document.createElement('a');link.href=asset.dataUrl;link.download=asset.name;link.click();}
  async function renderLibrary(){
    if(!$('sm-library-grid')||!store())return;
    try{const assets=await store().listAssets();const grid=$('sm-library-grid');grid.replaceChildren();$('sm-library-empty').hidden=assets.length>0;
      for(const asset of assets){const card=document.createElement('article');card.className='sm-library-card';const preview=document.createElement('button');preview.type='button';preview.className='sm-library-preview';preview.setAttribute('aria-label','预览'+asset.name);const img=new Image();img.src=asset.dataUrl;img.alt=asset.name;img.loading='lazy';preview.append(img);preview.onclick=()=>openAsset(asset);const title=document.createElement('h3');title.textContent=asset.name;const meta=document.createElement('p');meta.textContent=(modelNames[asset.model]||asset.model)+' · '+asset.ratio+' · '+new Date(asset.createdAt).toLocaleDateString();const actions=document.createElement('div');actions.className='sm-library-actions';for(const [label,fn] of [['用作底图',()=>useAsset(asset)],['下载',()=>downloadAsset(asset)],['移除',async()=>{await store().deleteAsset(asset.id);await renderLibrary();message('sm-library-status','已移除素材');}]]){const button=document.createElement('button');button.type='button';button.className='sm-button';button.textContent=label;button.onclick=()=>Promise.resolve().then(fn).catch(e=>message('sm-library-status',e.message,true));actions.append(button);}card.append(preview,title,meta,actions);grid.append(card);}
      message('sm-library-status',assets.length?`${assets.length}份生成素材 · 保存在此浏览器，可下载到团队共享目录`:'生成完成后会自动保存到这里');
    }catch(error){message('sm-library-status','素材库暂不可用：'+error.message,true);}
  }
  function openAsset(asset){
    let dialog=$('sm-asset-dialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='sm-asset-dialog';dialog.className='sm-asset-dialog';document.body.append(dialog);}dialog.replaceChildren();const close=document.createElement('button');close.textContent='×';close.className='sm-dialog-close';close.setAttribute('aria-label','关闭素材预览');close.onclick=()=>dialog.close();const img=new Image();img.src=asset.dataUrl;img.alt=asset.name;const prompt=document.createElement('textarea');prompt.readOnly=true;prompt.value=asset.prompt;prompt.setAttribute('aria-label','生成时使用的提示词');const use=document.createElement('button');use.className='sm-button primary';use.textContent='用作底图';use.onclick=()=>{dialog.close();useAsset(asset);};dialog.append(close,img,prompt,use);dialog.showModal();
  }
  async function snapshot(){const project=await editor().snapshot();project.generation=generation();return project;}
  function queueSave(){
    if(state.projectBusy||!store()||!editor()?.valid())return;clearTimeout(state.saveTimer);const sequence=++state.saveSequence;
    state.saveTimer=setTimeout(async()=>{try{const project=await snapshot();if(sequence!==state.saveSequence||state.projectBusy)return;await store().saveDraft(project);message('sm-project-status','草稿已自动保存到此浏览器');}catch(error){message('sm-project-status','草稿未保存：'+error.message,true);}},650);
  }
  async function loadProject(project){state.projectBusy=true;state.saveSequence++;clearTimeout(state.saveTimer);try{await editor().restore(project);restoreGeneration(project.generation);location.hash='sm-samples';message('sm-project-status','工程已载入，可以继续编辑');}finally{state.projectBusy=false;}queueSave();}
  async function init(){
    if(!$('sm-gen-run'))return;
    $('sm-gen-build').onclick=()=>{try{buildPrompt();}catch(error){message('sm-gen-status',error.message,true);}};
    $('sm-gen-copy').onclick=async()=>{if(!$('sm-gen-prompt').value.trim()){message('sm-gen-status','先整理提示词或输入提示词',true);return;}message('sm-gen-status',await editor().copy($('sm-gen-prompt').value)?'提示词已复制':'复制失败，请手动复制',false);};
    $('sm-gen-run').onclick=event=>{event.preventDefault();generate();};$('sm-gen-cancel').onclick=cancelGeneration;
    $('sm-gen-reference').onchange=event=>addReferences(event.target.files);$('sm-gen-reference-clear').onclick=()=>{if(state.busy)return;state.references=[];showReferences();message('sm-gen-status','已清空参考图，将使用文生图');};
    const drop=$('sm-gen-reference-drop');drop.addEventListener('dragover',event=>{if(!event.dataTransfer.types.includes('Files'))return;event.preventDefault();if(!state.busy)drop.dataset.dragging='true';});drop.addEventListener('dragleave',()=>delete drop.dataset.dragging);drop.addEventListener('drop',event=>{event.preventDefault();delete drop.dataset.dragging;addReferences(event.dataTransfer.files);});
    $('sm-gen-use').onclick=()=>state.result&&useAsset(state.result);
    $('sm-nav-robot')?.addEventListener('click',()=>{$('sm-gen-style').value='robot';$('sm-gen-topic').placeholder='例如：白色球形机器人斜向飞行，带着一张比特币icon卡片';message('sm-gen-status','机器人创作：先加入官方角色原档，再描述本次动作与主题');});
    for(const key of ['prompt','topic','ratio','style','composition','model'])$('sm-gen-'+key).addEventListener('input',()=>{queueSave();if(['topic','ratio','style','composition'].includes(key))message('sm-gen-status','参数已更新，点击“整理提示词”同步；也可直接编辑最终提示词');});
    $('sm-save-project').onclick=async()=>{try{store().download(await snapshot());message('sm-project-status','工程已导出，包含底图、文字与样式');}catch(error){message('sm-project-status',error.message,true);}};
    $('sm-open-project').onclick=()=>$('sm-project-file').click();$('sm-project-file').onchange=async event=>{try{const file=event.target.files[0];if(file)await loadProject(await store().readFile(file));}catch(error){message('sm-project-status','打开失败：'+error.message,true);}finally{event.target.value='';}};
    document.addEventListener('social-editor:change',queueSave);window.addEventListener('hashchange',()=>{if(location.hash==='#sm-library')renderLibrary();});
    const retry=document.createElement('button');retry.type='button';retry.className='sm-service-retry';retry.textContent='重新检测连接';retry.onclick=refreshService;$('sm-gen-service').after(retry);
    await Promise.allSettled([refreshService(),renderLibrary()]);
    try{const draft=await store().loadDraft();if(draft){state.projectBusy=true;await editor().restore(draft);restoreGeneration(draft.generation);message('sm-project-status','已恢复此浏览器的上次草稿');}}catch(error){message('sm-project-status','草稿未恢复：'+error.message,true);}finally{state.projectBusy=false;}
    document.dispatchEvent(new Event('social-studio:ready'));
  }
  if(document.getElementById('social-media')?.dataset.smReady==='true')init();else document.addEventListener('social-media:ready',init,{once:true});
})();
