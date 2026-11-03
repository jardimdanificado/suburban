import {ASSET_DATA} from './assets_data.js';
import {SPRITE_CLASSIFICATIONS} from './sprite_classification.js';
import {ideologicalProfile,politicalPosition} from './city_ideology.js';
import {drawPixelText} from './pixel_text.js?v=pixel-text-1';

export const COUNCIL_INSTITUTIONAL_FLAG=Object.freeze({foreground:'#f5e9bf',background:'#4c655c',skin:'Feature_Flower.png',pattern:1});
const PARTY_EMBLEMS=Object.freeze(ASSET_DATA.filter(asset=>/\.png$/i.test(asset.filename)).map(asset=>asset.filename));
const imageCache=new Map(),tintedCache=new Map(),pendingImages=new Map();
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const ICON_LAYOUTS=Object.freeze({
  1:[
    {name:'centro',slots:[{x:.3,y:.18,w:.4,h:.64}]},{name:'centro-amplo',slots:[{x:.2,y:.08,w:.6,h:.82}]},
    {name:'canto-superior-esquerdo',slots:[{x:.04,y:.04,w:.38,h:.54}]},{name:'canto-inferior-direito',slots:[{x:.58,y:.42,w:.38,h:.54}]},
    {name:'centro-esquerda',slots:[{x:.04,y:.22,w:.38,h:.56}]},{name:'centro-direita',slots:[{x:.58,y:.22,w:.38,h:.56}]},
    {name:'alto-central',slots:[{x:.3,y:.02,w:.4,h:.5}]},{name:'baixo-central',slots:[{x:.3,y:.48,w:.4,h:.5}]}
  ],
  2:[
    {name:'horizontal',slots:[{x:.03,y:.16,w:.43,h:.68},{x:.54,y:.16,w:.43,h:.68}]},{name:'vertical',slots:[{x:.22,y:.02,w:.56,h:.43},{x:.22,y:.55,w:.56,h:.43}]},
    {name:'diagonal-descendente',slots:[{x:.02,y:.02,w:.42,h:.58},{x:.56,y:.4,w:.42,h:.58}]},{name:'diagonal-ascendente',slots:[{x:.56,y:.02,w:.42,h:.58},{x:.02,y:.4,w:.42,h:.58}]},
    {name:'duas-faixas-laterais',slots:[{x:.02,y:.22,w:.3,h:.56},{x:.68,y:.22,w:.3,h:.56}]},{name:'duas-colunas',slots:[{x:.19,y:.04,w:.28,h:.92},{x:.53,y:.04,w:.28,h:.92}]},
    {name:'cantos-opostos',slots:[{x:.03,y:.03,w:.35,h:.48},{x:.62,y:.49,w:.35,h:.48}]},{name:'topo-e-base',slots:[{x:.32,y:.02,w:.36,h:.36},{x:.32,y:.62,w:.36,h:.36}]}
  ],
  3:[
    {name:'triangulo',slots:[{x:.34,y:.02,w:.32,h:.45},{x:.02,y:.52,w:.42,h:.46},{x:.56,y:.52,w:.42,h:.46}]},{name:'linha-tripla',slots:[{x:.02,y:.2,w:.3,h:.6},{x:.35,y:.2,w:.3,h:.6},{x:.68,y:.2,w:.3,h:.6}]},
    {name:'coluna-tripla',slots:[{x:.3,y:.01,w:.4,h:.29},{x:.3,y:.355,w:.4,h:.29},{x:.3,y:.7,w:.4,h:.29}]},{name:'tres-cantos',slots:[{x:.02,y:.02,w:.36,h:.47},{x:.62,y:.02,w:.36,h:.47},{x:.32,y:.52,w:.36,h:.46}]},
    {name:'lado-centro-lado',slots:[{x:.02,y:.3,w:.3,h:.4},{x:.35,y:.15,w:.3,h:.7},{x:.68,y:.3,w:.3,h:.4}]},{name:'degrau',slots:[{x:.02,y:.54,w:.3,h:.44},{x:.35,y:.28,w:.3,h:.44},{x:.68,y:.02,w:.3,h:.44}]},
    {name:'duas-em-cima-uma-embaixo',slots:[{x:.08,y:.02,w:.38,h:.46},{x:.54,y:.02,w:.38,h:.46},{x:.31,y:.52,w:.38,h:.46}]},{name:'uma-em-cima-duas-embaixo',slots:[{x:.31,y:.02,w:.38,h:.46},{x:.08,y:.52,w:.38,h:.46},{x:.54,y:.52,w:.38,h:.46}]}
  ],
  4:[
    {name:'quadrantes',slots:[{x:0,y:0,w:.5,h:.5},{x:.5,y:0,w:.5,h:.5},{x:0,y:.5,w:.5,h:.5},{x:.5,y:.5,w:.5,h:.5}]},
    {name:'quatro-cantos',slots:[{x:.02,y:.02,w:.38,h:.43},{x:.6,y:.02,w:.38,h:.43},{x:.02,y:.55,w:.38,h:.43},{x:.6,y:.55,w:.38,h:.43}]},
    {name:'losango',slots:[{x:.34,y:.01,w:.32,h:.28},{x:.02,y:.36,w:.3,h:.28},{x:.68,y:.36,w:.3,h:.28},{x:.34,y:.71,w:.32,h:.28}]},
    {name:'linha-de-quatro',slots:[{x:.01,y:.28,w:.23,h:.44},{x:.26,y:.28,w:.23,h:.44},{x:.51,y:.28,w:.23,h:.44},{x:.76,y:.28,w:.23,h:.44}]},
    {name:'coluna-de-quatro',slots:[{x:.27,y:.01,w:.46,h:.23},{x:.27,y:.26,w:.46,h:.23},{x:.27,y:.51,w:.46,h:.23},{x:.27,y:.76,w:.46,h:.23}]},
    {name:'grade-aberta',slots:[{x:.04,y:.03,w:.38,h:.38},{x:.58,y:.03,w:.38,h:.38},{x:.04,y:.59,w:.38,h:.38},{x:.58,y:.59,w:.38,h:.38}]},
    {name:'anel-quadrado',slots:[{x:.02,y:.02,w:.3,h:.38},{x:.68,y:.02,w:.3,h:.38},{x:.02,y:.6,w:.3,h:.38},{x:.68,y:.6,w:.3,h:.38}]},
    {name:'mosaico-de-quartos',slots:[{x:0,y:0,w:.5,h:.5,crop:{x:0,y:0,w:.5,h:.5}},{x:.5,y:0,w:.5,h:.5,crop:{x:.5,y:0,w:.5,h:.5}},{x:0,y:.5,w:.5,h:.5,crop:{x:0,y:.5,w:.5,h:.5}},{x:.5,y:.5,w:.5,h:.5,crop:{x:.5,y:.5,w:.5,h:.5}}]}
  ]
});
const TEXT_LAYOUTS=Object.freeze([
  {id:'sem-texto',boxes:[],area:{x:.035,y:.035,w:.93,h:.93}},
  {id:'frase-em-cima',boxes:[{x:.04,y:.025,w:.92,h:.17,kind:'phrase'}],area:{x:.035,y:.23,w:.93,h:.73}},
  {id:'frase-embaixo',boxes:[{x:.04,y:.805,w:.92,h:.17,kind:'phrase'}],area:{x:.035,y:.04,w:.93,h:.73}},
  {id:'frase-na-lateral-esquerda',boxes:[{x:.015,y:.08,w:.16,h:.84,rotation:-Math.PI/2,kind:'word'}],area:{x:.22,y:.035,w:.74,h:.93}},
  {id:'frase-na-lateral-direita',boxes:[{x:.825,y:.08,w:.16,h:.84,rotation:Math.PI/2,kind:'word'}],area:{x:.04,y:.035,w:.74,h:.93}},
  {id:'frase-em-cima-numero-embaixo',boxes:[{x:.04,y:.015,w:.92,h:.15,kind:'phrase'},{x:.04,y:.835,w:.92,h:.15,kind:'number'}],area:{x:.04,y:.205,w:.92,h:.59}},
  {id:'texto-nas-duas-laterais',boxes:[{x:.01,y:.12,w:.15,h:.76,rotation:-Math.PI/2,kind:'word'},{x:.84,y:.12,w:.15,h:.76,rotation:Math.PI/2,kind:'number'}],area:{x:.2,y:.04,w:.6,h:.92}},
  {id:'nome-e-numero-em-faixas',boxes:[{x:.04,y:.02,w:.92,h:.14,kind:'name'},{x:.04,y:.84,w:.92,h:.14,kind:'number'}],area:{x:.04,y:.2,w:.92,h:.6}}
]);
export const PARTY_FLAG_LAYOUTS=Object.freeze(Object.entries(ICON_LAYOUTS).flatMap(([count,arrangements])=>arrangements.flatMap(arrangement=>TEXT_LAYOUTS.map(textLayout=>Object.freeze({id:`${count}-${arrangement.name}-${textLayout.id}`,count:Number(count),arrangement:arrangement.name,textLayout:textLayout.id,slots:Object.freeze(arrangement.slots.map(slot=>Object.freeze({...slot}))),iconArea:Object.freeze({...textLayout.area}),textBoxes:Object.freeze(textLayout.boxes.map(box=>Object.freeze({...box})))})))));

export function flagContrast(a,b){
 const luminance=hex=>{const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;},x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
function randomColor(hue,lightness,saturation){
 const l=lightness,a=saturation*Math.min(l,1-l),f=n=>{const k=(n+hue/30)%12;return l-a*Math.max(-1,Math.min(k-3,9-k,1));};
 return `#${[f(0),f(8),f(4)].map(value=>Math.round(value*255).toString(16).padStart(2,'0')).join('')}`;
}
function weightedSprite(city,party,used){
 const profile=party?.ideology?ideologicalProfile(party):{economy:0,liberty:0,green:.4},economy=clamp(profile.economy||0,-1,1),liberty=clamp(profile.liberty||0,-1,1),green=clamp(profile.green??.4,0,1),greenAxis=green*2-1;
 const candidates=PARTY_EMBLEMS.filter(filename=>!used.has(filename));let total=0;const weights=candidates.map(filename=>{
  const affinity=SPRITE_CLASSIFICATIONS[filename]?.politicalAffinity||{economy:0,liberty:0,green:0};
  const alignment=economy*affinity.economy*.42+liberty*affinity.liberty*.28+greenAxis*affinity.green*.3;
  // Every asset remains selectable; the party's three ideological axes only
  // increase the odds of a symbol whose subject matter fits that profile.
  const weight=1.05+Math.max(-.3,alignment)*1.35;total+=weight;return weight;
 });
 let pick=city.random()*total;for(let i=0;i<candidates.length;i++){pick-=weights[i];if(pick<=0)return candidates[i];}return candidates.at(-1)||'Feature_Flower.png';
}
function chooseText(city,party,kind){
 const source=String(party?.slogan||party?.short||party?.name||'');
 if(kind==='number')return party?.number==null?String(party?.short||''):String(party.number);
 if(kind==='name')return String(party?.short||party?.name||'');
 if(kind==='word'){const words=source.split(/\s+/).filter(word=>word.length>2);return words.length?words[Math.floor(city.random()*words.length)]:String(party?.short||party?.name||'');}
 if(kind==='name-number')return `${party?.short||party?.name||''} ${party?.number??''}`.trim();
 if(kind==='phrase')return source;
 const kinds=['word','phrase','name','number','name-number'];return chooseText(city,party,kinds[Math.floor(city.random()*kinds.length)]);
}
function buildTexts(city,party,boxes,palette){return Object.freeze(boxes.map(box=>Object.freeze({...box,value:chooseText(city,party,box.kind),color:palette[2]||palette[1]})).filter(text=>text.value));}
function layoutEmblems(city,party,layout,palette){
 const used=new Set();return Object.freeze(layout.slots.map((slot,index)=>{
  const skin=weightedSprite(city,party,used);used.add(skin);const area=layout.iconArea;
  const inks=[palette[3],palette[1]].filter((color,inkIndex,array)=>color&&array.indexOf(color)===inkIndex&&flagContrast(color,palette[0])>=2.4),color=inks[index%Math.max(1,inks.length)]||palette[1];
  const shades=inks.filter(candidate=>candidate!==color),shade=shades.length?shades[index%shades.length]:color;
  return Object.freeze({skin,x:area.x+slot.x*area.w,y:area.y+slot.y*area.h,w:slot.w*area.w,h:slot.h*area.h,...(slot.crop?{crop:Object.freeze({...slot.crop})}:{}),color,shade,backgroundMode:city.random()<.07?'tile':'transparent'});
 }));
}
function flagPalette(city,hue,background,foreground){
 const colors=[background,foreground];
 const addAccent=()=>{
  let best=null,bestScore=-1;
  for(let attempt=0;attempt<64;attempt++){
   const accent=randomColor(city.random()*360,.24+city.random()*.58,.55+city.random()*.42);if(colors.includes(accent))continue;
   const score=Math.min(...colors.map(color=>flagContrast(accent,color)));if(score>bestScore){best=accent;bestScore=score;}if(score>=1.55)break;
  }
  if(best)colors.push(best);
 };
 // The third swatch separates lettering from both the field and the emblem.
 addAccent();if(colors.length===3&&city.random()<.3)addAccent();
 return Object.freeze(colors);
}
export function makePartyFlag(city,index,founders=[],party=null){
 const hue=city.random()*360,background=randomColor(hue,.19,.78);let foreground=randomColor((hue+180)%360,.88,.58);
 if(flagContrast(foreground,background)<4.5)foreground=flagContrast('#ffffff',background)>=flagContrast('#111111',background)?'#ffffff':'#111111';
 const colors=flagPalette(city,hue,background,foreground),count=1+Math.floor(city.random()*4),arrangements=ICON_LAYOUTS[count],arrangement=arrangements[Math.floor(city.random()*arrangements.length)],textLayout=TEXT_LAYOUTS[Math.floor(city.random()*TEXT_LAYOUTS.length)],layout=PARTY_FLAG_LAYOUTS.find(item=>item.id===`${count}-${arrangement.name}-${textLayout.id}`),emblems=layoutEmblems(city,party,layout,colors),texts=buildTexts(city,party,layout.textBoxes,colors),backgroundStyles=['solid','stripes-horizontal','stripes-vertical','stripes-diagonal','quartered','circle','double-circle','diamond','star','cross','chevron','border'],backgroundStyle=backgroundStyles[Math.floor(city.random()*backgroundStyles.length)];
 return Object.freeze({foreground,background,colors,pattern:Math.floor(city.random()*3),backgroundStyle,layoutId:layout.id,layoutName:arrangement.name,textLayout:layout.textLayout,colorSource:'random',emblems,texts,politicalPosition:party?.ideology?politicalPosition(ideologicalProfile(party).economy):null});
}
function requestImage(filename,onReady){
 let image=imageCache.get(filename);if(image?.complete&&image.naturalWidth)return image;
 if(typeof Image==='undefined')return null;
 if(!image){const asset=ASSET_DATA.find(row=>row.filename===filename);if(!asset)return null;image=new Image();imageCache.set(filename,image);image.onload=()=>{for(const callback of pendingImages.get(filename)||[])callback();pendingImages.delete(filename);};image.src=`data:image/png;base64,${asset.base64}`;}
 if(onReady){let callbacks=pendingImages.get(filename);if(!callbacks)pendingImages.set(filename,callbacks=new Set());callbacks.add(onReady);}return null;
}
function tintedSprite(filename,foreground,shade,background,transparent,onReady){
 const raw=requestImage(filename,onReady);if(!raw)return null;const key=`${filename}:${foreground}:${shade}:${background}:${transparent?'cutout':'tile'}`;if(tintedCache.has(key))return tintedCache.get(key);
 const canvas=document.createElement('canvas');canvas.width=raw.naturalWidth;canvas.height=raw.naturalHeight;const context=canvas.getContext('2d');context.drawImage(raw,0,0);const pixels=context.getImageData(0,0,canvas.width,canvas.height),data=pixels.data,fg=foreground.match(/\w\w/g).map(v=>parseInt(v,16)),sh=shade.match(/\w\w/g).map(v=>parseInt(v,16)),bg=background.match(/\w\w/g).map(v=>parseInt(v,16));
 if(transparent){
  const width=canvas.width,height=canvas.height,counts=new Map();
  for(let x=0;x<width;x++)for(const y of [0,height-1]){const i=(y*width+x)*4;if(data[i+3]){const key=[data[i]>>3,data[i+1]>>3,data[i+2]>>3].join(',');counts.set(key,(counts.get(key)||0)+1);}}
  for(let y=1;y<height-1;y++)for(const x of [0,width-1]){const i=(y*width+x)*4;if(data[i+3]){const key=[data[i]>>3,data[i+1]>>3,data[i+2]>>3].join(',');counts.set(key,(counts.get(key)||0)+1);}}
  let edgeKey='',edgeCount=0;for(const [key,count] of counts)if(count>edgeCount){edgeKey=key;edgeCount=count;}
  const existingTransparency=Array.from({length:width*height},(_,i)=>data[i*4+3]).some(alpha=>alpha===0);
  const parts=edgeKey.split(',').map(Number),seed=[parts[0]*8+4,parts[1]*8+4,parts[2]*8+4],edgeLuminance=seed[0]*.2126+seed[1]*.7152+seed[2]*.0722,eligible=existingTransparency||edgeCount>=Math.max(3,Math.ceil((width*2+height*2-4)*.22));
  if(!eligible){tintedCache.set(key,null);return null;}
  // Dark edge fields in this sprite set are usually baked-in black backdrops;
  // light edge fields are often real tile art (brickwork, stone patterns).
  if(!existingTransparency&&edgeLuminance>=128){tintedCache.set(key,null);return null;}
  if(!existingTransparency){
   const visited=new Uint8Array(width*height),stack=[];const push=(x,y)=>{const p=y*width+x;if(visited[p])return;visited[p]=1;const i=p*4;if(!data[i+3])return;const dr=data[i]-seed[0],dg=data[i+1]-seed[1],db=data[i+2]-seed[2];if(dr*dr+dg*dg+db*db<=48*48)stack.push(p);};
   for(let x=0;x<width;x++){push(x,0);push(x,height-1);}for(let y=1;y<height-1;y++){push(0,y);push(width-1,y);}
   let removed=0;while(stack.length){const p=stack.pop(),x=p%width,y=Math.floor(p/width),i=p*4;data[i+3]=0;removed++;if(x>0)push(x-1,y);if(x+1<width)push(x+1,y);if(y>0)push(x,y-1);if(y+1<height)push(x,y+1);}
   if(removed>width*height*.94){tintedCache.set(key,null);return null;}
  }
 }
 for(let i=0;i<data.length;i+=4){if(!data[i+3])continue;const color=data[i]+data[i+1]+data[i+2]>380?fg:(transparent?sh:bg);data[i]=color[0];data[i+1]=color[1];data[i+2]=color[2];}
 context.putImageData(pixels,0,0);tintedCache.set(key,canvas);return canvas;
}
function drawText(ctx,text,flag,x,y,w,h){
 const rotation=text.rotation||0,axisLength=rotation? h:w,boxHeight=rotation?w:h,centerX=x+w/2,centerY=y+h/2;ctx.save();ctx.translate(centerX,centerY);if(rotation)ctx.rotate(rotation);ctx.textAlign='center';ctx.textBaseline='middle';ctx.imageSmoothingEnabled=false;
 let size=Math.max(5,boxHeight*.74);ctx.font=`bold ${size}px monospace`;while(ctx.measureText(text.value).width>axisLength*.96&&size>4){size--;ctx.font=`bold ${size}px monospace`;}
 ctx.fillStyle=text.color||flag.colors?.[2]||flag.foreground;drawPixelText(ctx,text.value,0,0,axisLength*.96);ctx.restore();
}
function starPath(ctx,cx,cy,outer,inner,points=5){ctx.beginPath();for(let i=0;i<points*2;i++){const angle=-Math.PI/2+i*Math.PI/points,r=i%2?inner:outer,x=cx+Math.cos(angle)*r,y=cy+Math.sin(angle)*r;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.closePath();}
function drawFlagBackground(ctx,flag,x,y,w,h){
 const colors=flag.colors?.length?flag.colors:[flag.background,flag.foreground],accent=colors[2]||colors[1],style=flag.backgroundStyle;
 ctx.fillStyle=flag.background;ctx.fillRect(x,y,w,h);ctx.fillStyle=colors[1]||flag.foreground;
 if(style==='stripes-horizontal'){for(let i=0;i<5;i+=2)ctx.fillRect(x,y+h*i/5,w,h/5);}
 else if(style==='stripes-vertical'){for(let i=0;i<5;i+=2)ctx.fillRect(x+w*i/5,y,w/5,h);}
 else if(style==='stripes-diagonal'){ctx.save();ctx.translate(x+w/2,y+h/2);ctx.rotate(-Math.PI/4);for(let i=-5;i<=5;i+=2)ctx.fillRect(i*w/5,-h*1.4,w/5,h*2.8);ctx.restore();}
 else if(style==='quartered'){ctx.fillRect(x,y,w/2,h/2);ctx.fillRect(x+w/2,y+h/2,w/2,h/2);}
 else if(style==='circle'||style==='double-circle'){ctx.beginPath();ctx.arc(x+w/2,y+h/2,Math.min(w,h)*.42,0,Math.PI*2);ctx.fill();if(style==='double-circle'){ctx.fillStyle=accent;ctx.beginPath();ctx.arc(x+w/2,y+h/2,Math.min(w,h)*.25,0,Math.PI*2);ctx.fill();}}
 else if(style==='diamond'){ctx.beginPath();ctx.moveTo(x+w/2,y+h*.06);ctx.lineTo(x+w*.94,y+h/2);ctx.lineTo(x+w/2,y+h*.94);ctx.lineTo(x+w*.06,y+h/2);ctx.closePath();ctx.fill();}
 else if(style==='star'){starPath(ctx,x+w/2,y+h/2,Math.min(w,h)*.45,Math.min(w,h)*.2);ctx.fill();}
 else if(style==='cross'){ctx.fillRect(x+w*.4,y,w*.2,h);ctx.fillRect(x,y+h*.38,w,h*.24);}
 else if(style==='chevron'){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w*.48,y+h/2);ctx.lineTo(x,y+h);ctx.lineTo(x+w*.22,y+h);ctx.lineTo(x+w*.7,y+h/2);ctx.lineTo(x+w*.22,y);ctx.closePath();ctx.fill();}
 else if(style==='border'){ctx.lineWidth=Math.max(2,Math.min(w,h)*.1);ctx.strokeStyle=accent;ctx.strokeRect(x+w*.06,y+h*.07,w*.88,h*.86);}
 else if(!style){if(flag.pattern===1)ctx.fillRect(x,y+h*.42,w,h*.16);else if(flag.pattern===2){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w*.5,y+h*.5);ctx.lineTo(x,y+h);ctx.fill();}}
}
export function drawPartyFlag(ctx,flag,x,y,w=60,h=38,onReady=null){
 if(!flag)return;ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();drawFlagBackground(ctx,flag,x,y,w,h);
 const emblems=flag.emblems?.length?flag.emblems:flag.skin?[{skin:flag.skin,x:.3,y:.12,w:.4,h:.76}]:[];
 for(const emblem of emblems){const textInk=flag.colors?.[2],ink=emblem.color===textInk?(flag.colors?.[1]||flag.foreground):(emblem.color||flag.foreground),shade=emblem.shade===textInk?ink:(emblem.shade||ink),transparent=emblem.backgroundMode!=='tile',image=tintedSprite(emblem.skin,ink,shade,flag.background,transparent,onReady)||tintedSprite(emblem.skin,ink,shade,flag.background,false,onReady);if(!image)continue;ctx.save();ctx.imageSmoothingEnabled=false;const dx=x+emblem.x*w,dy=y+emblem.y*h,dw=emblem.w*w,dh=emblem.h*h,crop=emblem.crop;if(crop)ctx.drawImage(image,crop.x*image.width,crop.y*image.height,crop.w*image.width,crop.h*image.height,dx,dy,dw,dh);else ctx.drawImage(image,dx,dy,dw,dh);ctx.restore();}
 for(const text of flag.texts||[])drawText(ctx,text,flag,x+text.x*w,y+text.y*h,text.w*w,text.h*h);
 ctx.strokeStyle=flag.foreground;ctx.strokeRect(x,y,w,h);ctx.restore();
}
export function partyFlagCanvas(flag,onReady){
 const canvas=document.createElement('canvas');canvas.width=120;canvas.height=76;const redraw=()=>{drawPartyFlag(canvas.getContext('2d'),flag,0,0,120,76);onReady?.();};drawPartyFlag(canvas.getContext('2d'),flag,0,0,120,76,redraw);return canvas;
}
