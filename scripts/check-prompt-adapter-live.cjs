'use strict';
// Explicit real CLI vision verification in a temporary loopback server. Never
// terminates or reconfigures the already-running production adapter.
const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
async function main(){
 if(!process.argv.includes('--live'))throw Error('Pass --live to authorize a real CLI vision request');
 const imageIndex=process.argv.indexOf('--image');
 if(imageIndex<0||!process.argv[imageIndex+1]||process.argv[imageIndex+1].startsWith('--'))throw Error('Pass --image with a PNG file path');
 const imagePath=path.resolve(process.argv[imageIndex+1]);
 const bytes=fs.readFileSync(imagePath), root=path.resolve(__dirname,'..');
 const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));
 const origin='http://127.0.0.1:'+port;
 const child=spawn(process.execPath,[path.join(__dirname,'prompt-adapter-server.cjs')],{cwd:root,windowsHide:true,env:{...process.env,PROMPT_ADAPTER_PORT:String(port)},stdio:['ignore','ignore','pipe']});
 let stderr='';child.stderr.on('data',b=>stderr=(stderr+b.toString()).slice(-4000));
 const output=path.join(root,'checks/prompt-adapter-live');fs.mkdirSync(output,{recursive:true});
 let submitted=false,finished=false;
 try{
  let status;for(let attempt=0;attempt<30;attempt++){try{const r=await fetch(origin+'/api/prompt-adapter/status',{signal:AbortSignal.timeout(12000)});status=await r.json();if(!status.checking)break;}catch{}await new Promise(r=>setTimeout(r,300));}
  assert.equal(status?.available,true,stderr||status?.message||'Adapter did not start');
  const input={image:{dataUrl:'data:image/png;base64,'+bytes.toString('base64'),name:path.basename(imagePath)},instruction:'观察官方机器人原图，输出可直接使用的完整底图提示词。保留可见角色结构，手臂不承重、不穿模；黑白灰、平滑银色金属、白色哑光烤漆和黑玻璃，少量 #FF8200 点缀。真实可拍摄场景、柔和宽光源，所有表面无拉丝、木纹或粗糙颗粒；严禁抽象装置、轨道、悬浮硬币、装饰光效。严禁标题、口号、正文、长说明和营销文案；最多两个必要的物件短标签，非必要不加字。原图仅供实际观察，禁止作为下一轮像素参考，未来生成使用官方角色原档。后期文字和Logo在layout另行说明。'};
  const response=await fetch(origin+'/api/prompt-adapter',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(input)}),job=await response.json();
  assert.equal(response.status,202,JSON.stringify(job));submitted=true;
  console.log(JSON.stringify({stage:'submitted',jobId:job.jobId,isolatedPort:port}));
  const deadline=Date.now()+490000;let result;
  do{await new Promise(r=>setTimeout(r,2000));result=await(await fetch(origin+job.pollUrl)).json();if(['completed','failed','canceled'].includes(result.status)){finished=true;break;}}while(Date.now()<deadline);
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2));
  assert.equal(result.status,'completed',result.error?.message||'Vision request still pending');
  assert(result.result.prompt.length>150);
  console.log(JSON.stringify({stage:'completed',jobId:job.jobId,promptCharacters:result.result.prompt.length,analysisKeys:Object.keys(result.result.analysis),receipt:path.join(output,'result.json')}));
 }finally{
  // Only our own temporary server is stopped. Preserve an unknown pending job.
  if(!submitted||finished)child.kill();else console.log(JSON.stringify({stage:'pending',isolatedPid:child.pid,origin}));
 }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
