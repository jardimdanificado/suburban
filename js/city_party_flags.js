import {COLOR_PALETTE,colorAffinity} from './city_colors.js';
export const COUNCIL_INSTITUTIONAL_FLAG=Object.freeze({foreground:'#f5e9bf',background:'#4c655c',skin:'Feature_Flower.png',pattern:1});
import { ASSET_DATA } from './assets_data.js';

// Brutopolis clans choose a sprite emblem and a contrasting foreground/background pair.
// Keep only the tiny description in simulation state; textures belong to the renderer.
const skins=ASSET_DATA.map(a=>a.filename).filter(s=>/^Feature_|^Item_/.test(s));
const palettes=[['#ffe3a0','#822a31'],['#e8f5ff','#224a89'],['#fff5b7','#276347'],['#e9ddff','#633980'],['#ffeacf','#a14f20'],['#f2f2ed','#303b47'],['#ffdfef','#823d68'],['#d6ffff','#205e66']];
export function flagContrast(a,b){
 const luminance=hex=>{const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;},x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
export function founderColoredFlag(flag,founders=[]){
 const people=[...new Map(founders.filter(Boolean).map(c=>[c.id,c])).values()];if(!people.length)return Object.freeze({...flag});
 // Equal influence for each founder; a small compromise term avoids choosing
 // a color one founder adores but every other founder strongly dislikes.
 const score=color=>{const values=people.map(c=>colorAffinity(c,color));return values.reduce((n,v)=>n+v,0)/values.length*.8+Math.min(...values)*.2;};
 const background=[...COLOR_PALETTE].sort((a,b)=>score(b.hex)-score(a.hex))[0].hex;
 const foreground=[...COLOR_PALETTE.map(c=>c.hex),'#ffffff','#000000'].filter(c=>flagContrast(c,background)>=4.5).sort((a,b)=>score(b)-score(a)||flagContrast(b,background)-flagContrast(a,background))[0];
 return Object.freeze({...flag,background,foreground,colorSource:'founders',colorFounderIds:Object.freeze(people.map(c=>c.id))});
}
export function makePartyFlag(city,index,founders=[]) {
 const [foreground,background]=palettes[index%palettes.length];
 return founderColoredFlag({foreground,background,skin:skins[Math.floor(city.random()*skins.length)]||'Feature_Flower.png',pattern:Math.floor(city.random()*3)},founders);
}

const textures=new Map(),pending=new Map();
export function drawPartyFlag(ctx,flag,x,y,w=60,h=38,onReady=null) {
  if(!flag)return;
  ctx.fillStyle=flag.background;ctx.fillRect(x,y,w,h);
  ctx.fillStyle=flag.foreground;
  if(flag.pattern===1)ctx.fillRect(x,y+h*.42,w,h*.16);
  if(flag.pattern===2){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w*.5,y+h*.5);ctx.lineTo(x,y+h);ctx.fill();}
  const key=flag.skin+flag.foreground+flag.background;
  let tex=textures.get(key);
  if(!tex && typeof document!=='undefined') {
    pending.set(key,new Set());tex=document.createElement('canvas');tex.width=tex.height=16;textures.set(key,tex);
    const asset=ASSET_DATA.find(a=>a.filename===flag.skin),img=new Image();
    img.onload=()=>{const c=tex.getContext('2d');c.drawImage(img,0,0,16,16);const data=c.getImageData(0,0,16,16),fg=flag.foreground.match(/\w\w/g).map(v=>parseInt(v,16)),bg=flag.background.match(/\w\w/g).map(v=>parseInt(v,16));for(let i=0;i<data.data.length;i+=4){const color=data.data[i]+data.data[i+1]+data.data[i+2]>380?fg:bg;for(let j=0;j<3;j++)data.data[i+j]=color[j];}c.putImageData(data,0,0);for(const callback of pending.get(key)||[])callback();pending.delete(key);};
    if(asset)img.src=`data:image/png;base64,${asset.base64}`;
  }
  if(onReady&&pending.has(key))pending.get(key).add(onReady);
  if(tex){ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(tex,x+w*.3,y+h*.12,w*.4,h*.76);ctx.restore();}
  ctx.strokeStyle=flag.foreground;ctx.strokeRect(x,y,w,h);
}

// One canvas per roof banner; redraw once the generated emblem finishes loading.
export function partyFlagCanvas(flag,onReady){
  const canvas=document.createElement('canvas');canvas.width=120;canvas.height=76;
  const redraw=()=>{drawPartyFlag(canvas.getContext('2d'),flag,0,0,120,76);onReady?.();};
  drawPartyFlag(canvas.getContext('2d'),flag,0,0,120,76,redraw);
  return canvas;
}
