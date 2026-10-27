export const COUNCIL_INSTITUTIONAL_FLAG=Object.freeze({foreground:'#f5e9bf',background:'#4c655c',skin:'Feature_Flower.png',pattern:1});
import { ASSET_DATA } from './assets_data.js';

// Brutopolis clans choose a sprite emblem and a contrasting foreground/background pair.
// Keep only the tiny description in simulation state; textures belong to the renderer.
const skins=ASSET_DATA.map(a=>a.filename).filter(s=>/^Feature_|^Item_/.test(s));
export function flagContrast(a,b){
 const luminance=hex=>{const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;},x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
function randomColor(hue,lightness,saturation){
 const l=lightness;
 const a=saturation*Math.min(l,1-l),f=n=>{const k=(n+hue/30)%12;return l-a*Math.max(-1,Math.min(k-3,9-k,1));};
 return `#${[f(0),f(8),f(4)].map(value=>Math.round(value*255).toString(16).padStart(2,'0')).join('')}`;
}
export function makePartyFlag(city,index,founders=[]) {
 const hue=city.random()*360,background=randomColor(hue,.19,.78);
 let foreground=randomColor((hue+180)%360,.88,.58);
 if(flagContrast(foreground,background)<4.5)foreground=flagContrast('#ffffff',background)>=flagContrast('#111111',background)?'#ffffff':'#111111';
 return Object.freeze({foreground,background,skin:skins[Math.floor(city.random()*skins.length)]||'Feature_Flower.png',pattern:Math.floor(city.random()*3),colorSource:'random'});
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
