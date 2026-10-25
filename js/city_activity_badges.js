import {drawPartyFlag} from './city_party_flags.js';
/** Observation markers do not consume or replace physical goods. */
export function activityBadge(c){
  if(!c||c.entity?.destroyed||c.indoorLocation||c.ridingVehicleId)return null;
  if(c.task==='campaign'&&c.campaign){const m=c.campaign;return {kind:'campaign',label:'Campanha',flag:m.partyFlag||m.flag,color:m.speechColor||m.flag?.background||'#627db0',number:m.partyNumber??''};}
  if(c.task==='research'&&c.researchAssignment)return {kind:'research',label:'Pesquisando',color:'#3d819f'};
  if(c.task==='interview'&&c.pollInterview)return {kind:'interview',label:'Respondendo pesquisa',color:'#70a6b0'};
  if(c.task==='vote')return {kind:'vote',label:'Indo votar',color:'#c7a646'};
  if(c.task==='council-session')return {kind:'council',label:'Sessão da Câmara',color:'#9775b3'};
  if(c.cleaningJobId||c.task==='cleaning')return {kind:'cleaning',label:'Faxina',color:'#68a78d'};
  if(c.deliveryId)return {kind:'delivery',label:'Entrega',color:'#ba8b4a'};
  if(c.task==='construction')return {kind:'construction',label:'Construção',color:'#d3a94c'};
  if(c.task==='health'||c.task==='care'||c.task==='caregiving')return {kind:'care',label:'Cuidados de saúde',color:'#bc6868'};
  if(c.task==='drive-bus')return {kind:'transport',label:'Transporte',color:'#778db1'};
  return null;
}
export function activityBadgeKey(b){return b.kind==='campaign'?`${b.kind}:${b.number}:${b.color}:${JSON.stringify(b.flag||null)}`:b.kind;}
export function activityBadgeCanvas(b,onReady=null){
  const canvas=document.createElement('canvas');canvas.width=96;canvas.height=96;const ctx=canvas.getContext('2d');ctx.fillStyle='#18232ddd';ctx.beginPath();ctx.arc(48,46,43,0,Math.PI*2);ctx.fill();ctx.strokeStyle=b.color;ctx.lineWidth=5;ctx.stroke();ctx.strokeStyle='#ffffff';ctx.fillStyle='#ffffff';ctx.lineWidth=6;ctx.lineCap='round';ctx.lineJoin='round';
  if(b.kind==='campaign'){
    if(b.flag)drawPartyFlag(ctx,b.flag,23,22,52,35,()=>{drawPartyFlag(ctx,b.flag,23,22,52,35);onReady?.();});else{ctx.fillStyle=b.color;ctx.fillRect(28,24,45,28);ctx.strokeStyle='#fff';ctx.strokeRect(28,24,45,28);}
    ctx.strokeStyle='#fff';ctx.beginPath();ctx.moveTo(26,22);ctx.lineTo(26,75);ctx.stroke();ctx.fillStyle='#fff';ctx.font='bold 23px sans-serif';ctx.textAlign='center';ctx.fillText(String(b.number).padStart(2,'0'),57,79);
  }else if(b.kind==='research'){
    ctx.beginPath();ctx.arc(41,39,19,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(55,54);ctx.lineTo(73,73);ctx.stroke();
  }else if(b.kind==='interview'){
    ctx.strokeRect(22,23,52,36);ctx.beginPath();ctx.moveTo(35,59);ctx.lineTo(35,73);ctx.lineTo(49,59);ctx.stroke();ctx.font='bold 24px sans-serif';ctx.textAlign='center';ctx.fillText('?',48,50);
  }else if(b.kind==='vote'){
    ctx.strokeRect(23,48,50,28);ctx.beginPath();ctx.moveTo(33,50);ctx.lineTo(63,50);ctx.stroke();ctx.save();ctx.translate(48,33);ctx.rotate(-.2);ctx.strokeRect(-12,-14,24,28);ctx.restore();
  }else if(b.kind==='care'){
    ctx.fillRect(40,23,16,52);ctx.fillRect(22,41,52,16);
  }else if(b.kind==='delivery'){
    ctx.strokeRect(23,27,50,45);ctx.beginPath();ctx.moveTo(48,27);ctx.lineTo(48,52);ctx.moveTo(23,39);ctx.lineTo(73,39);ctx.stroke();
  }else if(b.kind==='construction'){
    ctx.beginPath();ctx.arc(48,54,24,Math.PI,0);ctx.lineTo(72,61);ctx.lineTo(24,61);ctx.closePath();ctx.stroke();ctx.beginPath();ctx.moveTo(18,64);ctx.lineTo(78,64);ctx.moveTo(48,29);ctx.lineTo(48,51);ctx.stroke();
  }else if(b.kind==='cleaning'){
    ctx.beginPath();ctx.moveTo(63,23);ctx.lineTo(44,52);ctx.moveTo(38,49);ctx.lineTo(57,61);ctx.lineTo(45,77);ctx.lineTo(24,63);ctx.closePath();ctx.stroke();
  }else if(b.kind==='council'){
    ctx.beginPath();ctx.moveTo(22,38);ctx.lineTo(48,22);ctx.lineTo(74,38);ctx.closePath();ctx.stroke();for(const x of [29,48,67]){ctx.beginPath();ctx.moveTo(x,43);ctx.lineTo(x,68);ctx.stroke();}ctx.beginPath();ctx.moveTo(20,74);ctx.lineTo(76,74);ctx.stroke();
  }else{ctx.strokeRect(25,24,46,48);ctx.fillRect(30,30,36,20);}
  return canvas;
}
