import {drawDisplay,DISPLAY_STATES,DISPLAY_LABELS} from './display-states-v7.mjs';
// Runtime performance controls. Original GLB arrays and files remain untouched.
export function createPerformance(T,{model,rig,renderer,scene,camera,controls,shadow},data,energy,motion,cues,gestures){
 const shell=[];model.traverse(o=>{if(o.isMesh&&o.material.name==='Shell_Logo_Realtime')shell.push(o);});
 const arms={left:[],right:[]},audit=[];
 for(const mesh of shell){
  const p=mesh.geometry.attributes.position,ix=mesh.geometry.index,lists={body:[],left:[],right:[]};
  for(let k=0;k<ix.count;k+=3){const tri=[ix.getX(k),ix.getX(k+1),ix.getX(k+2)],xs=tri.map(i=>p.getX(i));const key=xs.every(x=>x>1.23)?'right':xs.every(x=>x< -1.23)?'left':'body';lists[key].push(...tri);}
  if(!lists.left.length||!lists.right.length)continue;
  mesh.visible=false;
  for(const side of ['body','left','right']){const g=mesh.geometry.clone();g.setIndex(lists[side]);g.computeBoundingBox();g.computeBoundingSphere();const part=new T.Mesh(g,mesh.material);part.name='Performance_'+side;
   if(side==='body'){part.position.copy(mesh.position);part.quaternion.copy(mesh.quaternion);part.scale.copy(mesh.scale);mesh.parent.add(part);}
   else{const sign=side==='left'?-1:1,pivot=new T.Group();pivot.name='Shoulder_'+side;pivot.position.set(sign*1.27,.10,0);part.position.copy(pivot.position).multiplyScalar(-1);pivot.add(part);mesh.parent.add(pivot);arms[side].push(pivot);}
  }
  audit.push({mesh:mesh.name,originalTriangles:ix.count/3,bodyTriangles:lists.body.length/3,leftArmTriangles:lists.left.length/3,rightArmTriangles:lists.right.length/3,allTrianglesRetained:lists.body.length+lists.left.length+lists.right.length===ix.count});
 }
 const covers=[];model.traverse(o=>{if(o.isMesh&&o.material.name==='材质.010')covers.push(o);});
 for(const mesh of covers){const p=mesh.geometry.attributes.position,ix=mesh.geometry.index,lists={left:[],right:[]};for(let k=0;k<ix.count;k+=3){const tri=[ix.getX(k),ix.getX(k+1),ix.getX(k+2)],side=p.getX(tri[0])<0?'left':'right';lists[side].push(...tri);}mesh.visible=false;for(const side of ['left','right']){const pivot=arms[side][0];if(!pivot)throw Error('Shoulder pivot missing');const g=mesh.geometry.clone();g.setIndex(lists[side]);const part=new T.Mesh(g,mesh.material);part.position.copy(pivot.position).multiplyScalar(-1);pivot.add(part);}audit.push({mesh:mesh.name,originalTriangles:ix.count/3,leftArmTriangles:lists.left.length/3,rightArmTriangles:lists.right.length/3,allTrianglesRetained:lists.left.length+lists.right.length===ix.count});}
 const faceCanvas=document.createElement('canvas');faceCanvas.width=1024;faceCanvas.height=768;const ctx=faceCanvas.getContext('2d');
 const faceTex=new T.CanvasTexture(faceCanvas);faceTex.colorSpace=T.SRGBColorSpace;faceTex.flipY=true;
 const screens=[];model.traverse(o=>{if(o.isMesh&&o.material.name==='眼睛贴图')screens.push(o);});
 for(const screen of screens){const g=screen.geometry.clone(),p=g.attributes.position,uv=new Float32Array(p.count*2);for(let i=0;i<p.count;i++){uv[i*2]=(p.getX(i)+.862125)/1.72425;uv[i*2+1]=(p.getY(i)+.364019)/1.341015;}g.setAttribute('uv',new T.BufferAttribute(uv,2));screen.geometry=g;screen.material=new T.MeshStandardMaterial({name:'Performance_LED_Face',color:0x08090b,metalness:0,roughness:1,emissive:0xffffff,emissiveMap:faceTex,emissiveIntensity:1.25,envMapIntensity:0,side:T.DoubleSide});}
 const clamp=T.MathUtils.clamp,smooth=(t,a,b)=>T.MathUtils.smoothstep(t,a,b),pulse=(t,a,b,c,d)=>smooth(t,a,b)*(1-smooth(t,c,d));

 function displayAt(frame){const t=frame/30;const windows=[[0,1,'greet'],[1,2.5,'happy'],[4.72,5.48,'question'],[5.94,6.7,'scan'],[10.5,11.6,'confirm'],[16.15,17.1,'confirm'],[19.18,20.0,'thinking'],[23.3,24.0,'scan'],[28.0,28.7,'question'],[32.3,33.7,'alert'],[35.2,36.2,'scan'],[37.5,38.3,'confirm'],[45.4,46.8,'alert'],[50,52,'bye']];const found=windows.find(w=>t>=w[0]&&t<w[1]);if(found)return found[2];return Array.from({length:8},(_,i)=>energy[Math.max(0,frame-i)]||0).every(x=>x<.055)?'idle':'speaking';}

 function face(state,gaze,blink,talk,t,frame,forced){ctx.fillStyle='#000';ctx.fillRect(0,0,1024,768);let old=state,age=12;
  if(!forced)for(let i=1;i<=12;i++){const prev=displayAt(Math.max(0,frame-i));if(prev!==state){old=prev;age=i-1;break;}}
  const u=smooth(age,0,10);if(old!==state&&u<1)drawDisplay(ctx,{state:old,t,talk,gaze,blink,alpha:1-u});drawDisplay(ctx,{state,t,talk,gaze,blink,alpha:old===state?1:u});faceTex.needsUpdate=true;
 }

 function pose(frame,forcedState=null){
  const sampleFrame=Math.max(0,Math.min(Number.isFinite(frame)?frame:0,gestures.length-1.001));frame=Math.floor(sampleFrame);const t=sampleFrame/30;const block=data.blocks.findLast(b=>b.from<=frame)||data.blocks[0];const n=block.index,local=n===0?t:(frame-block.from)/30;
  let left=0,right=0,tilt=0,yaw=0,pitch=0,gaze=0,mood='neutral',lean=0;
  const speech=energy[frame]||0;const talk=(.6*(energy[frame]||0)+.25*(energy[Math.max(0,frame-1)]||0)+.15*(energy[Math.max(0,frame-2)]||0));
  const cue=cues.find(c=>t>=c.start&&t<=c.end);const j=Math.min(Math.floor(sampleFrame),gestures.length-2),u=sampleFrame-j;const a=gestures[j],b=gestures[j+1],g=Object.fromEntries(Object.keys(a).map(k=>[k,a[k]+(b[k]-a[k])*u]));left=g.l;right=g.r;pitch=g.pitch;yaw=g.yaw;tilt=g.roll;gaze=g.gaze;mood=cue?.id||'neutral';
  const travel=motion[frame]||{};const moving=travel.moving||0;
  left=T.MathUtils.lerp(left,-.72,moving*.85);right=T.MathUtils.lerp(right,.72,moving*.85);
  gaze=T.MathUtils.lerp(gaze,Math.sign(travel.vx||0)*.8,moving*.7);
  pitch+=(travel.pitch||0)+moving*.13;tilt-=(travel.bank||0);yaw+=moving*Math.sign(travel.vx||0)*.15;
  if(moving>.65)mood='focus';
  const targetX=travel.targetX||540;const swap=T.MathUtils.smoothstep(targetX-(travel.cx||540),-110,110);const prev=left;left=T.MathUtils.lerp(left,-right,swap);right=T.MathUtils.lerp(right,-prev,swap);gaze=T.MathUtils.lerp(gaze,Math.abs(gaze),swap);yaw=T.MathUtils.lerp(yaw,Math.abs(yaw),swap);for(const pivot of arms.left)pivot.rotation.set(T.MathUtils.lerp(g.lx,.55,moving*.7),T.MathUtils.lerp(g.ly,.13,moving*.7),left);
  for(const pivot of arms.right)pivot.rotation.set(T.MathUtils.lerp(g.rx,-.55,moving*.7),T.MathUtils.lerp(g.ry,-.13,moving*.7),right);
  rig.position.set(0,lean,g.z);rig.rotation.set(pitch,yaw,tilt);
  const blink=Math.max(pulse(t,.16,.24,.30,.40),pulse(t,3.75,3.83,3.90,4.01),pulse(t,9.1,9.18,9.25,9.35),pulse(t,15.1,15.18,15.25,15.36),pulse(t,22.9,22.98,23.05,23.16),pulse(t,30.1,30.18,30.25,30.36),pulse(t,37.6,37.68,37.75,37.87),pulse(t,44.8,44.88,44.95,45.07),pulse(t,49.7,49.78,49.85,49.97));
  if(forcedState&&!DISPLAY_STATES.includes(forcedState))throw Error('Unknown display state');const displayState=forcedState||displayAt(frame);face(displayState,gaze,blink,talk,t,frame,forcedState);const signal=displayState==='speaking'?smooth(talk,.055,.30):0;
  controls.update();if(shadow)shadow.visible=false;renderer.render(scene,camera);
  const tip=model.getObjectByName('球体');const point=tip.getWorldPosition(new T.Vector3()).project(camera);const emitter={x:(point.x+1)*480,y:(1-point.y)*480};return {emitter,frame,segment:block.id,mood,gaze,blink,leftShoulder:left,rightShoulder:right,bodyTilt:tilt,bodyYaw:yaw,nod:pitch,movement:travel,speechEnvelope:talk,eyeSignal:signal,displayState,behavior:cue?{id:cue.id,target:cue.target,purpose:cue.purpose}:null};
 }
 function previewState(frame,state){const sample=178+frame%218;pose(sample,state);for(const pivot of [...arms.left,...arms.right])pivot.rotation.set(0,0,0);rig.position.set(0,0,0);rig.rotation.set(0,0,0);controls.update();face(state,0,0,energy[sample]||0,frame/30,frame,true);renderer.render(scene,camera);return {state,frame};}
 return {pose,previewState,audit,displayStates:DISPLAY_STATES,displayLabels:DISPLAY_LABELS,controls:['left shoulder','right shoulder','blink','gaze','happy','curious','focus','concern','body nod','head shake','speech energy','voice-driven eye waves','eye signal scan']};
}
