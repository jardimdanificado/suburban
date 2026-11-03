import {ASSET_DATA} from './assets_data.js';
import {SPRITE_CLASSIFICATIONS} from './sprite_classification.js';
import {ideologicalProfile,politicalPosition} from './city_ideology.js';
import {drawPixelText} from './pixel_text.js?v=pixel-text-1';

export const COUNCIL_INSTITUTIONAL_FLAG=Object.freeze({foreground:'#f5e9bf',background:'#4c655c',skin:'Feature_Flower.png',pattern:1});
const PARTY_EMBLEMS=Object.freeze(ASSET_DATA.filter(asset=>/\.png$/i.test(asset.filename)).map(asset=>asset.filename));
const imageCache=new Map(),tintedCache=new Map(),pendingImages=new Map();
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

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
function overlaps(a,b,gap=.012){return a.x<b.x+b.w+gap&&a.x+a.w+gap>b.x&&a.y<b.y+b.h+gap&&a.y+a.h+gap>b.y;}
function placeEmblems(city,party,amount,textBand){
 const used=new Set(),placed=[],minY=textBand?.side==='top'?.23:.04,maxY=textBand?.side==='bottom'?.76:.96;
 for(let i=0;i<amount;i++){
  const skin=weightedSprite(city,party,used);used.add(skin);
  const width=.105+city.random()*.13,height=.19+city.random()*.18;let position=null;
  for(let attempt=0;attempt<120&&!position;attempt++){
   const candidate={skin,x:.035+city.random()*(.93-width),y:minY+city.random()*Math.max(0,maxY-minY-height),w:width,h:height};
   if(placed.every(other=>!overlaps(candidate,other)))position=candidate;
  }
  if(position)placed.push(Object.freeze(position));
 }
 return Object.freeze(placed);
}
function textPlan(city,party){
 if(!party||city.random()>.64)return null;
 const kinds=['name','number','slogan','name-number'];let kind=kinds[Math.floor(city.random()*kinds.length)];
 if(kind==='number'&&party.number==null)kind='name';
 const value=kind==='number'?String(party.number):kind==='slogan'?party.slogan||party.short:kind==='name-number'?`${party.short||party.name} ${party.number??''}`.trim():party.short||party.name;
 if(!value)return null;const side=city.random()<.5?'top':'bottom';return Object.freeze({kind,value:String(value),side,x:.06,y:side==='top'?.055:.825,w:.88,h:.12});
}
export function makePartyFlag(city,index,founders=[],party=null){
 const hue=city.random()*360,background=randomColor(hue,.19,.78);let foreground=randomColor((hue+180)%360,.88,.58);
 if(flagContrast(foreground,background)<4.5)foreground=flagContrast('#ffffff',background)>=flagContrast('#111111',background)?'#ffffff':'#111111';
 const text=textPlan(city,party),count=1+Math.floor(city.random()*4),emblems=placeEmblems(city,party,count,text);
 return Object.freeze({foreground,background,pattern:Math.floor(city.random()*3),colorSource:'random',emblems,texts:Object.freeze(text?[text]:[]),politicalPosition:party?.ideology?politicalPosition(ideologicalProfile(party).economy):null});
}
function requestImage(filename,onReady){
 let image=imageCache.get(filename);if(image?.complete&&image.naturalWidth)return image;
 if(typeof Image==='undefined')return null;
 if(!image){const asset=ASSET_DATA.find(row=>row.filename===filename);if(!asset)return null;image=new Image();imageCache.set(filename,image);image.onload=()=>{for(const callback of pendingImages.get(filename)||[])callback();pendingImages.delete(filename);};image.src=`data:image/png;base64,${asset.base64}`;}
 if(onReady){let callbacks=pendingImages.get(filename);if(!callbacks)pendingImages.set(filename,callbacks=new Set());callbacks.add(onReady);}return null;
}
function tintedSprite(filename,foreground,background,onReady){
 const raw=requestImage(filename,onReady);if(!raw)return null;const key=`${filename}:${foreground}:${background}`;if(tintedCache.has(key))return tintedCache.get(key);
 const canvas=document.createElement('canvas');canvas.width=raw.naturalWidth;canvas.height=raw.naturalHeight;const context=canvas.getContext('2d');context.drawImage(raw,0,0);const pixels=context.getImageData(0,0,canvas.width,canvas.height),fg=foreground.match(/\w\w/g).map(v=>parseInt(v,16)),bg=background.match(/\w\w/g).map(v=>parseInt(v,16));
 for(let i=0;i<pixels.data.length;i+=4){if(!pixels.data[i+3])continue;const color=pixels.data[i]+pixels.data[i+1]+pixels.data[i+2]>380?fg:bg;pixels.data[i]=color[0];pixels.data[i+1]=color[1];pixels.data[i+2]=color[2];}
 context.putImageData(pixels,0,0);tintedCache.set(key,canvas);return canvas;
}
function drawText(ctx,text,flag,x,y,w,h){
 const px=h*.16,centerX=x+w/2,centerY=y+h/2;ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.imageSmoothingEnabled=false;
 let size=Math.max(5,px);ctx.font=`bold ${size}px monospace`;while(ctx.measureText(text.value).width>w*.96&&size>4){size--;ctx.font=`bold ${size}px monospace`;}
 ctx.fillStyle=flag.foreground;drawPixelText(ctx,text.value,centerX,centerY,w*.98);ctx.restore();
}
export function drawPartyFlag(ctx,flag,x,y,w=60,h=38,onReady=null){
 if(!flag)return;ctx.fillStyle=flag.background;ctx.fillRect(x,y,w,h);ctx.fillStyle=flag.foreground;
 if(flag.pattern===1)ctx.fillRect(x,y+h*.42,w,h*.16);else if(flag.pattern===2){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w*.5,y+h*.5);ctx.lineTo(x,y+h);ctx.fill();}
 let grainSeed=2166136261;for(const char of `${flag.background}${flag.foreground}${flag.pattern}`)grainSeed=Math.imul(grainSeed^char.charCodeAt(0),16777619);const grain=()=>{grainSeed=(Math.imul(grainSeed,1664525)+1013904223)>>>0;return grainSeed/0x100000000;};ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.globalAlpha=.10;for(let i=0;i<20;i++){ctx.fillStyle=i%2?'#f4e8ca':'#303c37';ctx.fillRect(Math.floor(x+grain()*w),Math.floor(y+grain()*h),1+(i%4===0?1:0),1);}ctx.restore();
 const emblems=flag.emblems?.length?flag.emblems:flag.skin?[{skin:flag.skin,x:.3,y:.12,w:.4,h:.76}]:[];
 for(const emblem of emblems){const image=tintedSprite(emblem.skin,flag.foreground,flag.background,onReady);if(!image)continue;ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(image,x+emblem.x*w,y+emblem.y*h,emblem.w*w,emblem.h*h);ctx.restore();}
 for(const text of flag.texts||[])drawText(ctx,text,flag,x+text.x*w,y+text.y*h,text.w*w,text.h*h);
 ctx.strokeStyle=flag.foreground;ctx.strokeRect(x,y,w,h);
}
export function partyFlagCanvas(flag,onReady){
 const canvas=document.createElement('canvas');canvas.width=120;canvas.height=76;const redraw=()=>{drawPartyFlag(canvas.getContext('2d'),flag,0,0,120,76);onReady?.();};drawPartyFlag(canvas.getContext('2d'),flag,0,0,120,76,redraw);return canvas;
}
