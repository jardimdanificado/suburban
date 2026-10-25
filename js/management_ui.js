import { LegacyCanvasUI } from './legacy_ui.js';

export const MANAGEMENT_THEME = {
  ink:'#242014',muted:'#534d3c',paper:'#d6ceb6',face:'#b1a58b',light:'#eee4c8',shadow:'#7b705a',border:'#4c4435',
  header:'#e7bd59',headerLight:'#ffe598',captionInk:'#201a0e',inactiveHeader:'#b4a17a',selected:'#ead18a',row:'#cbc1a7',gold:'#805307',green:'#305c28',red:'#963226',blue:'#284f69',track:'#a2987f',line:'#b0a48a',
};
const T=MANAGEMENT_THEME;
const legacyColors={'#ffffff':T.ink,'#bcbcbc':T.muted,'#f8b800':T.gold,'#3cbcfc':T.blue,'#40c8f8':T.blue,'#58d854':T.green,'#ff6060':T.red};
export function readableLabel(value) {
  const text=String(value??'');
  return /^[A-ZÀ-Ü0-9º\s/<>:+%.,…-]+$/.test(text)&&text.length>3 ? text.charAt(0)+text.slice(1).toLocaleLowerCase('pt-BR') : text;
}
export function bevel(ctx,x,y,w,h,{inset=false,fill=T.face}={}) {
  ctx.save();ctx.fillStyle=fill;ctx.fillRect(x,y,w,h);
  ctx.lineWidth=1;ctx.strokeStyle=T.border;ctx.strokeRect(x+.5,y+.5,w-1,h-1);
  ctx.fillStyle=inset?T.shadow:T.light;ctx.fillRect(x+1,y+1,w-2,1);ctx.fillRect(x+1,y+1,1,h-2);
  ctx.fillStyle=inset?T.light:T.shadow;ctx.fillRect(x+1,y+h-2,w-2,1);ctx.fillRect(x+w-2,y+1,1,h-2);ctx.restore();
}

/** Classic management-game chrome, with readable system fonts at native device resolution. */
export class ManagementCanvasUI extends LegacyCanvasUI {
  beginFrame(x=-1,y=-1){this.pointer={x,y};super.beginFrame(x,y);}
  font(scale=1,bold=false){return `${bold||scale>1?'600':'400'} ${Math.round(scale>1?16:11)}px Tahoma, Verdana, sans-serif`;}
  textWidth(value,scale=1){
    const text=readableLabel(value),font=this.font(scale),key=`${font}:${text}`;this.widthCache??=new Map();
    if(this.widthCache.has(key))return this.widthCache.get(key);
    this.ctx.save();this.ctx.font=font;const width=this.ctx.measureText(text)?.width;this.ctx.restore();const result=Number.isFinite(width)?width:text.length*7*scale;
    if(this.widthCache.size>=4096)this.widthCache.delete(this.widthCache.keys().next().value);this.widthCache.set(key,result);return result;
  }
  fitText(value,width,scale=1){const text=String(value??'');if(width<=0)return '';if(this.textWidth(text,scale)<=width)return text;const suffix='…';let low=0,high=text.length;while(low<high){const middle=Math.ceil((low+high)/2);if(this.textWidth(text.slice(0,middle)+suffix,scale)<=width)low=middle;else high=middle-1;}return low?text.slice(0,low)+suffix:width>=this.textWidth(suffix,scale)?suffix:'';}
  text(value,x,y,color=T.ink,scale=1){
    const ctx=this.ctx;ctx.save();ctx.font=this.font(scale);ctx.textBaseline='top';ctx.fillStyle=legacyColors[color]||color;
    readableLabel(value).split('\n').forEach((line,i)=>ctx.fillText(line,x,y+i*(scale>1?19:14)));ctx.restore();
  }
  button(x,y,w,h,label,onClick,{selected=false,danger=false}={}){
    const ctx=this.ctx,hover=this.pointer&&this.pointer.x>=x&&this.pointer.x<=x+w&&this.pointer.y>=y&&this.pointer.y<=y+h;
    bevel(ctx,x,y,w,h,{inset:selected,fill:selected?T.selected:hover?T.paper:T.face});
    const title=readableLabel(label);ctx.save();ctx.beginPath();ctx.rect(x+3,y+2,w-6,h-4);ctx.clip();ctx.font=this.font(1,selected);ctx.textBaseline='middle';ctx.textAlign='center';ctx.fillStyle=danger?T.red:T.ink;ctx.fillText(title,x+w/2+(selected?1:0),y+h/2+(selected?1:0));ctx.restore();
    this.regions.push({x,y,w,h,label,onClick});
  }
  clickAt(x,y){const region=this.hitTest(x,y);if(region)region.onClick?.({x,y});return !!region;}
  box(x,y,w,h){bevel(this.ctx,x,y,w,h);}
  bar(x,y,w,h,value,max,label='',color=T.green){
    bevel(this.ctx,x,y,w,h,{inset:true,fill:T.track});const pct=Math.max(0,Math.min(1,max>0?value/max:0));this.ctx.fillStyle=legacyColors[color]||color;this.ctx.fillRect(x+3,y+3,(w-6)*pct,h-6);
    if(label)this.text(label,x+6,y+2,T.ink);
  }
  panel(x,y,w,h,title,text=''){
    const ctx=this.ctx;bevel(ctx,x,y,w,h);ctx.fillStyle=T.header;ctx.fillRect(x+3,y+3,w-6,25);ctx.fillStyle=T.headerLight;ctx.fillRect(x+3,y+3,w-6,1);
    ctx.save();ctx.font=this.font(1,true);ctx.textBaseline='middle';ctx.fillStyle=T.captionInk;ctx.fillText(readableLabel(title),x+10,y+15);ctx.restore();
    this.regions.push({x,y,w,h,onClick:null});if(text)this.text(text,x+10,y+38);
  }
  drawHud({title='SUBURBAN',status='',buttons=[]}={}){
    bevel(this.ctx,0,0,this.width,34);this.text(title,12,9,T.ink);const total=buttons.reduce((n,b)=>n+Math.max(48,b.label.length*8+18)+6,0),right=this.width-total-8;
    if(right>300)this.text(status,110,9,T.muted);
    let x=right;for(const b of buttons){const w=Math.max(48,b.label.length*8+18);this.button(x,5,w,24,b.label,b.onClick,{selected:!!b.selected});x+=w+6;}
  }
  drawActionBar(buttons=[],{timeControls=[]}={}){
    const widthFor=b=>Math.max(32,b.label.length*8+18),total=[...buttons,...timeControls].reduce((n,b)=>n+widthFor(b)+6,10),twoRows=timeControls.length&&total>this.width-8,h=twoRows?68:36,y=this.height-h;
    bevel(this.ctx,0,y,this.width,h);
    const row=(items,py,start=8)=>{let x=start;for(const b of items){const w=widthFor(b);if(x+w>this.width-8)break;this.button(x,py,w,24,b.label,b.onClick,{selected:!!b.selected});x+=w+6;}return x;};
    const x=row(buttons,y+6);row(timeControls,twoRows?y+36:y+6,twoRows?8:x+8);
  }
}
