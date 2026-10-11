// Character display artwork. All coordinates live on the existing visor texture.
export const DISPLAY_STATES=['idle','greet','speaking','thinking','scan','confirm','question','alert','happy','bye'];
export const DISPLAY_LABELS={idle:'待機',greet:'招呼',speaking:'語音訊號',thinking:'思考',scan:'觀察',confirm:'確認',question:'疑問',alert:'注意',happy:'開心',bye:'告別'};
const WHITE='#f4f2ec',ORANGE='#ff8200';
export function drawDisplay(ctx,{state,t,talk=0,gaze=0,blink=0,alpha=1}){
 ctx.save();ctx.globalAlpha=alpha;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=WHITE;ctx.fillStyle=WHITE;
 const cx=512+gaze*18,cy=384;
 const line=(points,color=WHITE,width=12)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();};
 const circle=(x,y,r,color=WHITE,fill=false,width=8)=>{ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);if(fill){ctx.fillStyle=color;ctx.fill();}else{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}};
 const word=(text,size,color=WHITE,y=cy)=>{ctx.fillStyle=color;ctx.font=`700 ${size}px Arial, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,cx,y);};
 const joyEyes=()=>{for(const sign of [-1,1]){ctx.strokeStyle=WHITE;ctx.lineWidth=22;ctx.beginPath();ctx.ellipse(cx+sign*135,cy-12,58,Math.max(8,55*(1-blink)),0,Math.PI,Math.PI*2);ctx.stroke();}};
 if(state==='idle'){circle(cx,cy,36+4*Math.sin(t*2),ORANGE,true);ctx.globalAlpha*=.3;circle(cx,cy,72+9*Math.sin(t*2),WHITE,false,3);}
 if(state==='greet'){word('Open',112,WHITE,cy-10);ctx.fillStyle=ORANGE;ctx.font='700 112px Arial';ctx.fillText('X',cx+186,cy-10);line([[cx-126,cy+95],[cx+126,cy+95]],ORANGE,5);}
 if(state==='speaking'){
  const amp=12+talk*112;
  for(const k of [-1,0,1]){ctx.globalAlpha=alpha*(k===0?1:.38);const pts=[];for(let i=0;i<=120;i++){const u=i/120,x=172+u*680,envelope=Math.sin(Math.PI*u)**1.5;pts.push([x,cy+k*52+amp*envelope*(Math.sin(u*15-t*10+k*.8)+.2*Math.sin(u*28+t*7))]);}line(pts,k===0?ORANGE:WHITE,k===0?9:5);}
  ctx.globalAlpha=alpha*.65;for(let i=0;i<5;i++){const height=10+talk*25*(.5+.5*Math.sin(t*8+i));line([[cx+(i-2)*20,cy+165-height],[cx+(i-2)*20,cy+165]],WHITE,5);}
 }
 if(state==='thinking'){circle(cx,cy,112,'#404542',false,4);for(let i=0;i<3;i++){const a=t*1.7+i*Math.PI*2/3;circle(cx+Math.cos(a)*112,cy+Math.sin(a)*112,14-i*2,i===0?ORANGE:WHITE,true);}circle(cx,cy,10,WHITE,true);}
 if(state==='scan'){circle(cx,cy,138,WHITE,false,5);circle(cx,cy,78,'#59615a',false,3);const a=t*1.3;line([[cx,cy],[cx+Math.cos(a)*126,cy+Math.sin(a)*126]],ORANGE,7);circle(cx-63,cy+39,12,ORANGE,true);line([[cx-166,cy],[cx-147,cy]],WHITE,4);line([[cx+147,cy],[cx+166,cy]],WHITE,4);}
 if(state==='confirm'){circle(cx,cy,139,'#48504a',false,5);const q=Math.min(1,(t%2)/.45);line([[cx-85,cy+4],[cx-25,cy+65],[cx+105*q,cy+65-160*q]],ORANGE,25);}
 if(state==='question'){word('?',234,WHITE,cy-7);circle(cx+123,cy-100,13,ORANGE,true);}
 if(state==='alert'){line([[cx,cy-146],[cx+157,cy+126],[cx-157,cy+126],[cx,cy-146]],ORANGE,10);line([[cx,cy-57],[cx,cy+31]],WHITE,19);circle(cx,cy+76,11,WHITE,true);}
 if(state==='happy'){joyEyes();circle(cx-221,cy-93,10,ORANGE,true);circle(cx+221,cy-93,10,ORANGE,true);}
 if(state==='bye'){joyEyes();ctx.globalAlpha*=.8;const x=cx+223,y=cy-96,r=20+3*Math.sin(t*5);line([[x-r,y],[x+r,y]],ORANGE,6);line([[x,y-r],[x,y+r]],ORANGE,6);}
 ctx.restore();
}
