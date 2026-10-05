(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  if (!$('business-components')) return;
  const records = [
    {id:'OX-20261001-D4827',type:'deposit',amount:'1250.34',status:'done',date:'2026-10-01T14:32:00+08:00',network:'TRON',hash:'c914ea9d61b6202d075f0a27d8bb7f1e521852bad791486b6a7f782f2d4032c1'},
    {id:'OX-20261001-W3168',type:'withdraw',amount:'380.5',status:'processing',date:'2026-10-01T11:18:00+08:00',network:'Ethereum',hash:null},
    {id:'OX-20260930-D2941',type:'deposit',amount:'2784.125',status:'done',date:'2026-09-30T19:06:00+08:00',network:'TRON',hash:'bd54697399a98fb9e6ccdd18f19a98b478c7154690b87a3a9b0f6865fdb97e31'},
    {id:'OX-20260929-W7352',type:'withdraw',amount:'642.08',status:'pending',date:'2026-09-29T08:44:00+08:00',network:'Ethereum',hash:null},
    {id:'OX-20260928-D9136',type:'deposit',amount:'512.3485',status:'done',date:'2026-09-28T16:21:00+08:00',network:'TRON',hash:'ea95c48490f2a25d9f0470cd0a096497dcc1b6ae7953f6bcbf7bf91249faebc8'},
    {id:'OX-20260927-W4683',type:'withdraw',amount:'864.22',status:'failed',date:'2026-09-27T12:09:00+08:00',network:'Ethereum',hash:null},
    {id:'OX-20260926-D5824',type:'deposit',amount:'1736.62',status:'done',date:'2026-09-26T09:47:00+08:00',network:'TRON',hash:'d21a0ff5ea2293c88774b485ca08f80f85ff4d78b9d25ba6c871c20914f5d3a7'},
    {id:'OX-20260925-W8275',type:'withdraw',amount:'426.19',status:'done',date:'2026-09-25T17:38:00+08:00',network:'TRON',hash:'1bf94ca9cbe4f980ae98bd657426210332b17b1a3b2d3c87e802d0a85ade7491'}
  ];
  const labels = {deposit:'充值',withdraw:'提现',done:'已完成',processing:'处理中',pending:'待处理',failed:'未完成'};
  const notes = {done:'交易已完成，可在下方核对完整交易编号与网络信息。',processing:'交易正在处理，完成后将更新状态与链上交易编号。',pending:'申请已提交，当前等待处理。',failed:'这笔交易未完成，请在业务详情中查看具体原因后处理。'};
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const amount = value => {const [whole,fraction='']=String(value).split('.');const dec=fraction.replace(/0+$/,'');return whole.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(dec?'.'+dec:'');};
  const exactCompare = (a,b) => {const [aw,af='']=a.split('.'),[bw,bf='']=b.split('.');if(aw.length!==bw.length)return aw.length-bw.length;if(aw!==bw)return aw<bw?-1:1;const n=Math.max(af.length,bf.length),ap=af.padEnd(n,'0'),bp=bf.padEnd(n,'0');return ap===bp?0:ap<bp?-1:1;};
  let page=1, sortKey='date', sortDirection=-1, current=records.slice(), selected=new Set(), activeRecord=null;
  const perPage=4;
  const icon = status => `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.3"/>${status==='done'?'<path d="m4.7 8 2.1 2.1 4.5-4.5" stroke="currentColor" stroke-width="1.3"/>':status==='failed'?'<path d="M8 4.5v4M8 10.6v.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>':'<path d="M8 4.5V8l2.4 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>'}</svg>`;
  function visible(){return current.slice((page-1)*perPage,page*perPage);}
  function selection(){const rows=visible(),all=$('bc-select-all');all.disabled=!rows.length;all.checked=rows.length>0&&rows.every(row=>selected.has(row.id));all.indeterminate=rows.some(row=>selected.has(row.id))&&!all.checked;$('bc-selected').textContent=selected.size?`已选择 ${selected.size} 条记录`:'未选择记录';$('bc-clear-selection').hidden=!selected.size;}
  function render(){
    current.sort((a,b)=>sortDirection*(sortKey==='amount'?exactCompare(a.amount,b.amount):Date.parse(a.date)-Date.parse(b.date)));
    page=Math.min(page,Math.max(1,Math.ceil(current.length/perPage)));
    $('bc-records').innerHTML=visible().map(row=>`<tr><td><label class="bc-select-hit"><input type="checkbox" data-bc-select="${row.id}" aria-label="选择${labels[row.type]}记录 ${row.id}" ${selected.has(row.id)?'checked':''}></label></td><td><strong>${labels[row.type]}</strong><span class="bc-record-id">${row.id}</span></td><td><strong class="bc-record-amount">${amount(row.amount)}</strong></td><td><span class="bc-state is-${row.status}">${icon(row.status)}${labels[row.status]}</span></td><td><span>${row.date.slice(0,10).replaceAll('-','.')}</span><span class="bc-date-clock">${row.date.slice(11,16)}</span></td><td><button class="bc-text-btn" type="button" data-bc-detail="${row.id}" aria-label="查看交易 ${row.id} 的详情">详情 ↗</button></td></tr>`).join('');
    $('bc-empty').hidden=!!current.length;
    $('bc-count').textContent=`共 ${current.length} 条记录${current.length!==records.length?' · 已应用筛选':''}`;
    $('bc-page-label').textContent=current.length?`${(page-1)*perPage+1}–${Math.min(page*perPage,current.length)} / ${current.length} 条 · 第 ${page} 页`:'0 条记录';
    $('bc-prev').disabled=page===1;$('bc-next').disabled=page*perPage>=current.length;
    document.querySelectorAll('[data-bc-sort]').forEach(button=>{const active=button.dataset.bcSort===sortKey;button.parentElement.setAttribute('aria-sort',active?(sortDirection===1?'ascending':'descending'):'none');button.querySelector('span').textContent=active?(sortDirection===1?'↑':'↓'):'↕';});
    selection();
  }
  function filter(event){if(event)event.preventDefault();const from=$('bc-from').value,to=$('bc-to').value;$('bc-filter-error').textContent='';['bc-from','bc-to'].forEach(id=>$(id).removeAttribute('aria-invalid'));if(from&&to&&from>to){$('bc-filter-error').textContent='开始日期不能晚于结束日期，请调整日期范围。';$('bc-to').setAttribute('aria-invalid','true');$('bc-to').focus();return;}const query=$('bc-query').value.trim().toLocaleLowerCase();current=records.filter(row=>(!query||`${row.id} ${labels[row.type]}`.toLocaleLowerCase().includes(query))&&($('bc-type').value==='all'||$('bc-type').value===row.type)&&($('bc-status').value==='all'||$('bc-status').value===row.status)&&(!from||row.date.slice(0,10)>=from)&&(!to||row.date.slice(0,10)<=to));selected.clear();page=1;render();}
  function clear(){ $('bc-filters').reset();filter(); }
  $('bc-filters').addEventListener('submit',filter);$('bc-clear').addEventListener('click',clear);$('bc-empty-clear').addEventListener('click',clear);
  $('bc-prev').addEventListener('click',()=>{if(page>1){page--;render();}});$('bc-next').addEventListener('click',()=>{if(page*perPage<current.length){page++;render();}});
  document.querySelectorAll('[data-bc-sort]').forEach(button=>button.addEventListener('click',()=>{const next=button.dataset.bcSort;sortDirection=next===sortKey?-sortDirection:1;sortKey=next;page=1;render();}));
  $('bc-select-all').addEventListener('change',event=>{visible().forEach(row=>event.currentTarget.checked?selected.add(row.id):selected.delete(row.id));render();});
  $('bc-clear-selection').addEventListener('click',()=>{selected.clear();render();});
  $('bc-records').addEventListener('change',event=>{const check=event.target.closest('[data-bc-select]');if(check){check.checked?selected.add(check.dataset.bcSelect):selected.delete(check.dataset.bcSelect);selection();}});
  $('bc-records').addEventListener('click',event=>{const button=event.target.closest('[data-bc-detail]');if(!button)return;activeRecord=records.find(row=>row.id===button.dataset.bcDetail);const row=activeRecord;$('bc-dialog-title').textContent=labels[row.type]+'详情';$('bc-detail-list').innerHTML=[['交易编号',row.id],['金额',amount(row.amount)+' USDT'],['状态',labels[row.status]],['记录时间',row.date.slice(0,10).replaceAll('-','.')+' '+row.date.slice(11,19)+' UTC+8'],['网络',row.network],['链上交易编号',row.hash??'—'],['状态说明',notes[row.status]]].map(([key,value])=>`<div><dt>${escape(key)}</dt><dd>${escape(value)}</dd></div>`).join('');$('bc-copy-feedback').textContent='';$('bc-record-dialog').showModal();});
  $('bc-close-dialog').addEventListener('click',()=>$('bc-record-dialog').close());
  $('bc-copy-record').addEventListener('click',async()=>{if(!activeRecord)return;try{await navigator.clipboard.writeText(activeRecord.id);$('bc-copy-feedback').textContent='交易编号已复制';}catch{$('bc-copy-feedback').textContent='无法自动复制，请从上方完整编号手动复制。';}});
  $('bc-theme').addEventListener('click',()=>{const dark=$('bc-stage').dataset.theme!=='dark';['bc-stage','bc-upload-panel','bc-preferences','bc-record-dialog'].forEach(id=>$(id).dataset.theme=dark?'dark':'light');$('bc-theme').textContent=dark?'切换为浅色':'切换为深色';$('bc-theme').setAttribute('aria-pressed',String(dark));});
  $('bc-preferences').addEventListener('submit',event=>{event.preventDefault();const density=document.querySelector('[name="bc-density"]:checked').value;$('bc-stage').dataset.density=density;$('bc-stage').dataset.showId=String($('bc-show-id').checked);$('bc-pref-feedback').textContent=`已保存：${density==='compact'?'紧凑':'标准'}间距，${$('bc-show-id').checked?'显示':'隐藏'}交易编号。`;});
  // File validation mirrors AccountProfilePage without changing its business limits.
  let selectedFile=null,imageUrl=null,readVersion=0;
  function fileFeedback(message,error=false){$('bc-file-feedback').textContent=message;$('bc-file-feedback').classList.toggle('is-error',error);$('bc-file-feedback').setAttribute('role',error?'alert':'status');}
  async function chooseFile(file){if(!file)return;const version=++readVersion;const retain=selectedFile?' 已保留原文件。':'';if(!['image/jpeg','image/png','image/webp'].includes(file.type)){fileFeedback('仅支持 JPG、PNG 或 WebP 图片。'+retain,true);return;}if(file.size>5*1024*1024){fileFeedback('图片不能超过 5 MiB。'+retain,true);return;}const url=URL.createObjectURL(file);try{const decoded=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src=url;});if(version!==readVersion){URL.revokeObjectURL(url);return;}if(decoded.naturalWidth<128||decoded.naturalHeight<128){URL.revokeObjectURL(url);fileFeedback('图片尺寸至少需要 128 × 128px。'+retain,true);return;}if(imageUrl)URL.revokeObjectURL(imageUrl);imageUrl=url;selectedFile=file;$('bc-file-image').src=url;$('bc-upload-preview').hidden=false;$('bc-upload-label').textContent=file.name;$('bc-pick-file').textContent='更换图片';$('bc-remove-file').hidden=false;fileFeedback(`已选择 · ${(file.size/1024).toFixed(1)} KiB · ${decoded.naturalWidth} × ${decoded.naturalHeight}px`);}catch{URL.revokeObjectURL(url);if(version===readVersion)fileFeedback('图片无法读取，请重新选择。'+retain,true);}}
  $('bc-pick-file').addEventListener('click',()=>$('bc-file').click());$('bc-file').addEventListener('change',event=>{void chooseFile(event.target.files[0]);event.target.value='';});
  $('bc-remove-file').addEventListener('click',()=>{readVersion++;if(imageUrl)URL.revokeObjectURL(imageUrl);imageUrl=null;selectedFile=null;$('bc-file-image').removeAttribute('src');$('bc-upload-preview').hidden=true;$('bc-upload-label').textContent='选择或拖入图片';$('bc-pick-file').textContent='选择图片';$('bc-remove-file').hidden=true;fileFeedback('图片已移除，可重新选择。');$('bc-pick-file').focus();});
  const zone=$('bc-drop-zone');zone.addEventListener('dragover',event=>{event.preventDefault();zone.classList.add('is-dragging');});zone.addEventListener('dragleave',event=>{if(!zone.contains(event.relatedTarget))zone.classList.remove('is-dragging');});zone.addEventListener('drop',event=>{event.preventDefault();zone.classList.remove('is-dragging');if(event.dataTransfer.files.length>1){fileFeedback('每次选择一张图片，已保留当前选择。',true);return;}void chooseFile(event.dataTransfer.files[0]);});
  window.addEventListener('pagehide',()=>{if(imageUrl)URL.revokeObjectURL(imageUrl);});
  render();

  const series={
    day:{name:'今日',dates:['2026.10.01 00:00','2026.10.01 03:00','2026.10.01 06:00','2026.10.01 09:00','2026.10.01 12:00','2026.10.01 15:00','2026.10.01 18:00'],values:[53433.13,53608.47,53512.26,53876.54,54035.12,53994.8,54275.29]},
    week:{name:'7 天',dates:['2026.09.25','2026.09.26','2026.09.27','2026.09.28','2026.09.29','2026.09.30','2026.10.01'],values:[51214.67,51942.34,51670.19,52366.81,53147.2,53681.45,54275.29]},
    month:{name:'30 天',dates:['2026.09.02','2026.09.07','2026.09.12','2026.09.17','2026.09.22','2026.09.27','2026.10.01'],values:[46875.12,48327.66,47964.37,null,50963.18,51670.19,54275.29]}
  };
  let range='day',masked=false,chartWidth=0;
  const money=value=>Number(value).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const compact = matchMedia('(max-width:767px)');
  function heldValuePath(data,x,y){
    // PCHIP tangents preserve each interval's range; missing values remain H/V holds.
    const commands=[],fmt=value=>Number(value.toFixed(3));
    let previous=null;
    for(let start=0;start<data.length;){
      if(data[start]===null){if(previous!==null)commands.push('H'+fmt(x(start)));start++;continue;}
      let end=start;while(end+1<data.length&&data[end+1]!==null)end++;
      const points=data.slice(start,end+1).map((value,i)=>[x(start+i),y(value)]),n=points.length,h=[],d=[],m=[];
      for(let i=0;i<n-1;i++){h[i]=points[i+1][0]-points[i][0];d[i]=(points[i+1][1]-points[i][1])/h[i];}
      const edge=(h0,h1,d0,d1)=>{const v=((2*h0+h1)*d0-h0*d1)/(h0+h1);return Math.sign(v)!==Math.sign(d0)?0:Math.sign(d0)!==Math.sign(d1)&&Math.abs(v)>Math.abs(3*d0)?3*d0:v;};
      if(n===2)m[0]=m[1]=d[0];
      else if(n>2){m[0]=edge(h[0],h[1],d[0],d[1]);m[n-1]=edge(h[n-2],h[n-3],d[n-2],d[n-3]);for(let i=1;i<n-1;i++){const w1=2*h[i]+h[i-1],w2=h[i]+2*h[i-1];m[i]=d[i-1]*d[i]<=0?0:(w1+w2)/(w1/d[i-1]+w2/d[i]);}}
      const [firstX,firstY]=points[0];
      if(previous===null)commands.push(`M${fmt(firstX)},${fmt(firstY)}`);else commands.push('H'+fmt(firstX),'V'+fmt(firstY));
      for(let i=0;i<n-1;i++){const [px,py]=points[i],[nx,ny]=points[i+1],third=h[i]/3;commands.push(py===ny?'H'+fmt(nx):`C${fmt(px+third)},${fmt(py+m[i]*third)} ${fmt(nx-third)},${fmt(ny-m[i+1]*third)} ${fmt(nx)},${fmt(ny)}`);}
      previous=data[end];start=end+1;
    }
    return commands.length>1?commands.join(' '):'';
  }
  function chart(){
    const set=series[range],n=set.values.length,svg=$('dp-chart-svg'),mobile=compact.matches;
    const W=Math.max(160,Math.round(svg.getBoundingClientRect().width)||920),H=mobile?232:260,left=mobile?56:68,right=mobile?12:20,top=18,bottom=H-40;
    const values=set.values.filter(value=>value!==null),missing=n-values.length;
    const min=values.length?Math.floor(Math.min(...values)/500)*500:0,max=values.length?Math.ceil(Math.max(...values)/500)*500:0,span=max-min||1;
    const x=i=>left+i*(W-left-right)/Math.max(1,n-1),y=value=>bottom-(value-min)/span*(bottom-top);
    chartWidth=W;svg.style.aspectRatio=W+'/'+H;svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
    const path=heldValuePath(set.values,x,y),first=set.values.findIndex(value=>value!==null),last=set.values.findLastIndex(value=>value!==null);
    const paths=path?`<defs><linearGradient id="dp-trend-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--ox-brand-primary)" stop-opacity=".055"/><stop offset="100%" stop-color="var(--ox-brand-primary)" stop-opacity="0"/></linearGradient></defs><path class="dp-area" d="${path} L${x(n-1)},${bottom} L${x(first)},${bottom} Z"/><path class="dp-path" d="${path}"/>`:'';
    const grid=values.length?[0,.5,1].map(f=>{const val=min+span*f,yy=y(val);return `<line class="dp-grid" x1="${left}" x2="${W-right}" y1="${yy}" y2="${yy}"/><text x="${left-12}" y="${yy+4}" text-anchor="end">${val.toLocaleString('en-US')}</text>`;}).join(''):'';
    const dateLabels=[...new Set([0,Math.floor((n-1)/2),n-1])].map(i=>`<text x="${x(i)}" y="${H-8}" text-anchor="${i===0?'start':i===n-1?'end':'middle'}">${range==='day'?set.dates[i].slice(-5):set.dates[i].slice(5)}</text>`).join('');
    const points=set.values.map((value,i)=>value===null?'':`<g class="dp-point${i===last?' is-latest':''}" tabindex="0" role="img" aria-label="${set.dates[i]} UTC+8，${money(value)} USDT" data-dp-point="${i}"><circle cx="${x(i)}" cy="${y(value)}" r="12"/><circle class="dp-dot" cx="${x(i)}" cy="${y(value)}" r="3"/><title>${set.dates[i]} · ${money(value)} USDT</title></g>`).join('');
    const description=masked?'金额已隐藏':!values.length?'所选范围暂无有效估值，不绘制零值曲线。':`纵轴范围 ${min.toLocaleString('en-US')} 至 ${max.toLocaleString('en-US')} USDT。${missing?`包含 ${missing} 个缺失数据点。缺失区间维持上一有效值的水平线，直到下一有效数据的时刻再垂直更新；开头无有效值的区间不绘图。缺失日期在数据表中仍为 —。`:'估值不变时曲线保持水平。'}使用下方查看数据展开完整的日期与金额表。`;
    svg.innerHTML=`<title id="dp-chart-title">${set.name}资产估值趋势</title><desc id="dp-chart-desc">${description}</desc>${masked?'':grid+paths+points+dateLabels}`;
    $('dp-total').innerHTML=(masked?'••••••':set.values.at(-1)===null?'—':money(set.values.at(-1)))+' <small>USDT</small>';
    $('dp-chart-panel').classList.toggle('is-masked',masked);$('dp-hidden-note').hidden=!masked;
    $('dp-chart-values').innerHTML=set.dates.map((date,i)=>`<tr><td>${date}</td><td>${masked?'••••••':set.values[i]===null?'—':money(set.values[i])}</td></tr>`).join('');
    $('dp-chart-insight').textContent=masked?'金额与曲线已隐藏':!values.length?'所选范围暂无估值':missing?'缺失区间保持上一有效值的水平线，明细仍保留为 —':'估值不变时保持水平，选择点位可查看对应日期的估值';
    document.querySelectorAll('[data-dp-range]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.dpRange===range)));
  }
  document.querySelectorAll('[data-dp-range]').forEach(button=>button.addEventListener('click',()=>{range=button.dataset.dpRange;chart();}));
  $('dp-chart-svg').addEventListener('focusin',event=>{const point=event.target.closest('[data-dp-point]');if(point&&!masked){const i=Number(point.dataset.dpPoint);$('dp-chart-insight').textContent=`${series[range].dates[i]} UTC+8 · ${money(series[range].values[i])} USDT`;}});
  $('dp-chart-svg').addEventListener('pointerover',event=>{const point=event.target.closest('[data-dp-point]');if(point&&!masked){const i=Number(point.dataset.dpPoint);$('dp-chart-insight').textContent=`${series[range].dates[i]} UTC+8 · ${money(series[range].values[i])} USDT`;}});
  $('dp-visibility').addEventListener('click',()=>{masked=!masked;$('dp-visibility').setAttribute('aria-pressed',String(masked));$('dp-visibility').textContent=masked?'显示金额':'隐藏金额';chart();});
  $('dp-theme').addEventListener('click',()=>{const dark=$('dp-chart-panel').dataset.theme!=='dark';$('dp-chart-panel').dataset.theme=dark?'dark':'light';$('dp-theme').textContent=dark?'切换为浅色':'切换为深色';$('dp-theme').setAttribute('aria-pressed',String(dark));});
  const help=$('dp-gap-help'),tip=$('dp-gap-tip');let pinned=false;const tooltip=show=>{tip.hidden=!show;help.setAttribute('aria-expanded',String(show));};help.addEventListener('mouseenter',()=>tooltip(true));help.addEventListener('mouseleave',()=>{if(!pinned&&document.activeElement!==help)tooltip(false);});help.addEventListener('focus',()=>tooltip(true));help.addEventListener('blur',()=>{pinned=false;tooltip(false);});help.addEventListener('click',()=>{pinned=!pinned;tooltip(pinned);});help.addEventListener('keydown',event=>{if(event.key==='Escape'){pinned=false;tooltip(false);}});
  compact.addEventListener('change',chart);chart();new ResizeObserver(entries=>{const width=Math.round(entries[0].contentRect.width);if(width>0&&width!==chartWidth)chart();}).observe($('dp-chart-svg'));
})();
