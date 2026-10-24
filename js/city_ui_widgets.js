import { MANAGEMENT_THEME as T, bevel } from './management_ui.js';
export const UI_COLORS={gold:T.gold,gray:T.ink,muted:T.muted,green:T.green,red:T.red,cyan:T.blue,pink:'#86556d',surface:T.paper,line:T.line,ink:T.ink};
export const fitText=(value,width,scale=1)=>{const s=String(value??''),n=Math.max(0,Math.floor(width/(7*scale)));return s.length<=n?s:n>3?s.slice(0,n-1)+'…':s.slice(0,n);};
const widthOf=(ui,text)=>ui.textWidth?ui.textWidth(text):String(text).length*7;
const fit=(ui,text,width,scale=1)=>ui.fitText?ui.fitText(text,width,scale):fitText(text,width,scale);
const wraps=new WeakMap();
function wrapped(ui,value,width){
  let cache=wraps.get(ui);if(!cache){cache=new Map();wraps.set(ui,cache);}
  const text=String(value??''),key=`${ui.font?.()||''}:${width}:${text}`;
  if(cache.has(key))return cache.get(key);
  const lines=[];
  for(const paragraph of text.split('\n')){
    let line='';
    for(let word of paragraph.split(/\s+/)){
      if(line&&widthOf(ui,`${line} ${word}`)>width){lines.push(line);line='';}
      while(word.length>1&&widthOf(ui,word)>width){let n=Math.max(1,Math.floor(width/8));while(n>1&&widthOf(ui,word.slice(0,n))>width)n--;lines.push(word.slice(0,n));word=word.slice(n);}
      line+=(line?' ':'')+word;
    }
    lines.push(line);
  }
  if(cache.size>=1024)cache.delete(cache.keys().next().value);cache.set(key,lines);return lines;
}
const numeric=v=>typeof v==='number'||/^-?R\$|^-?\d+[%,]/.test(String(v));

/** Compact layouts with bounded text caches and viewport-only row rendering. */
export class UIPage {
  constructor(ui,x,y,w,top,bottom){Object.assign(this,{ui,x,y,w,top,bottom});}
  space(h=6){this.y+=h;}
  visible(h){return this.y+h>this.top&&this.y<this.bottom;}
  heading(value,color=T.ink){this.space(4);if(this.visible(19)){this.ui.text(fit(this.ui,value,this.w),this.x,this.y,color===T.gold?T.ink:color);this.ui.ctx.fillStyle=T.line;this.ui.ctx.fillRect(this.x,this.y+18,this.w,1);}this.y+=25;}
  line(value,color=T.muted){if(this.visible(17))this.ui.text(value,this.x,this.y,color);this.y+=17;}
  note(value,color=T.muted){const lines=wrapped(this.ui,value,this.w),start=this.y;const first=Math.max(0,Math.floor((this.top-start)/17)),last=Math.min(lines.length,Math.ceil((this.bottom-start)/17));for(let i=first;i<last;i++)this.ui.text(lines[i],this.x,start+i*17,color);this.y=start+lines.length*17+3;}
  kv(label,value){
    const text=String(value??''),wide=widthOf(this.ui,text)>this.w*.64,h=wide?36:23;
    if(this.visible(h)){
      const valueWidth=Math.min(this.w*.64,widthOf(this.ui,text)),labelWidth=wide?this.w:this.w-valueWidth-14;
      this.ui.text(fit(this.ui,label,labelWidth),this.x+2,this.y+4,T.muted);
      const shown=fit(this.ui,text,wide?this.w-4:valueWidth);
      this.ui.text(shown,wide?this.x+2:this.x+this.w-widthOf(this.ui,shown)-2,this.y+(wide?20:4),T.ink);
      this.ui.ctx.fillStyle=T.line;this.ui.ctx.fillRect(this.x,this.y+h-1,this.w,1);
      this.ui.regions.push({x:this.x,y:this.y,w:this.w,h,label:`${label}: ${text}`,onClick:null});
    }this.y+=h;
  }
  button(label,click,selected=false){if(this.visible(25))this.ui.button(this.x,this.y,this.w,25,fit(this.ui,label,this.w-18),click,{selected});this.y+=29;}
  buttons(items){let dx=0;for(const item of items){const w=Math.min(this.w,Math.ceil(widthOf(this.ui,item.label))+22);if(dx&&dx+w>this.w){dx=0;this.y+=28;}if(this.visible(25))this.ui.button(this.x+dx,this.y,w,25,fit(this.ui,item.label,w-18),item.click,{selected:item.selected});dx+=w+4;}this.y+=29;}
  card(title,subtitle,click,selected,color=T.blue){const lines=String(subtitle??'').split('\n'),h=24+lines.length*17;if(this.visible(h)){const ctx=this.ui.ctx;ctx.fillStyle=selected?T.selected:T.paper;ctx.fillRect(this.x,this.y,this.w,h);ctx.fillStyle=T.line;ctx.fillRect(this.x,this.y+h-1,this.w,1);this.ui.text(fit(this.ui,title,this.w-25),this.x+6,this.y+4,T.ink);ctx.fillStyle=color;ctx.fillRect(this.x+this.w-10,this.y+8,4,4);for(const[i,line]of lines.entries())this.ui.text(fit(this.ui,line,this.w-16),this.x+6,this.y+22+i*17,T.muted);this.ui.regions.push({x:this.x,y:this.y,w:this.w,h,label:`${title} — ${lines.join(' / ')}`,onClick:click});}this.y+=h+2;}
  record(title,subtitle,click,selected=false,{value='',color=T.blue}={}){
    const h=43;if(this.visible(h)){const ctx=this.ui.ctx;ctx.fillStyle=selected?T.selected:T.paper;ctx.fillRect(this.x,this.y,this.w,h-1);ctx.fillStyle=color;ctx.fillRect(this.x,this.y+5,3,h-12);ctx.fillStyle=T.line;ctx.fillRect(this.x,this.y+h-2,this.w,1);
      const right=fit(this.ui,value,this.w*.38),rw=right?widthOf(this.ui,right)+12:0;
      this.ui.text(fit(this.ui,title,this.w-16-rw),this.x+8,this.y+4,T.ink);if(right)this.ui.text(right,this.x+this.w-widthOf(this.ui,right)-4,this.y+4,color);
      this.ui.text(fit(this.ui,subtitle,this.w-16),this.x+8,this.y+23,T.muted);
      this.ui.regions.push({x:this.x,y:this.y,w:this.w,h:h-1,label:`${title} — ${subtitle}${value?' — '+value:''}`,onClick:click});
    }this.y+=h;
  }
  rows(items,draw,height=43){const start=this.y,first=Math.max(0,Math.floor((this.top-start)/height)),last=Math.min(items.length,Math.ceil((this.bottom-start)/height));for(let i=first;i<last;i++){this.y=start+i*height;draw(items[i],i);}this.y=start+items.length*height;}
  meter(label,value,color){const pct=Math.max(0,Math.min(100,Number(value)||0));if(this.visible(26)){const ctx=this.ui.ctx,fill=color||(pct<30?T.red:pct<65?T.gold:T.green),amount=`${Math.round(pct)}%`;this.ui.text(fit(this.ui,label,this.w-42),this.x,this.y,T.ink);this.ui.text(amount,this.x+this.w-widthOf(this.ui,amount),this.y,fill);ctx.fillStyle=T.track;ctx.fillRect(this.x,this.y+18,this.w,5);ctx.fillStyle=fill;ctx.fillRect(this.x,this.y+18,this.w*pct/100,5);}this.y+=29;}
  meters(items){const cols=this.w>=360?2:1,gap=14,cw=Math.floor((this.w-(cols-1)*gap)/cols);for(let i=0;i<items.length;i+=cols){for(let j=0;j<cols&&i+j<items.length;j++){const page=new UIPage(this.ui,this.x+j*(cw+gap),this.y,cw,this.top,this.bottom);page.meter(...items[i+j]);}this.y+=30;}}
  metrics(items){const cols=this.w>=560&&items.length%4===0?4:this.w>=560&&items.length%3===0?3:2,gap=6,cw=Math.floor((this.w-gap*(cols-1))/cols);for(let i=0;i<items.length;i+=cols){const h=items.slice(i,i+cols).some(item=>item[3])?65:53;if(this.visible(h))for(let j=0;j<cols&&i+j<items.length;j++){const[label,value,color=T.ink,hint='',click]=items[i+j],x=this.x+j*(cw+gap),ctx=this.ui.ctx;ctx.fillStyle=T.row;ctx.fillRect(x,this.y,cw,h-4);this.ui.text(fit(this.ui,label,cw-16),x+8,this.y+5,T.muted);const scale=widthOf(this.ui,value)*1.5<=cw-16?2:1;this.ui.text(fit(this.ui,value,cw-16,scale),x+8,this.y+24,color===T.gold?T.ink:color,scale);if(hint)this.ui.text(fit(this.ui,hint,cw-16),x+8,this.y+48,T.muted);if(click)this.ui.regions.push({x,y:this.y,w:cw,h:h-4,label,onClick:click});}this.y+=h;}}
  columns(left,right){if(this.w<600){left(this);right(this);return;}const gap=14,width=Math.floor((this.w-gap)/2),a=new UIPage(this.ui,this.x,this.y,width,this.top,this.bottom),b=new UIPage(this.ui,this.x+width+gap,this.y,this.w-width-gap,this.top,this.bottom);left(a);right(b);this.y=Math.max(a.y,b.y);}
  table(columns,rows,{empty='Nenhum registro encontrado.'}={}){
    if(!rows.length){this.note(empty);return;}
    if(this.w<360){this.rows(rows,row=>this.record(row.cells[0],row.cells.slice(1).map((v,i)=>`${columns[i+1].label}: ${v}`).join(' · '),row.click,row.selected,{color:row.color||T.blue}));this.space(4);return;}
    const total=columns.reduce((n,c)=>n+(c.weight||1),0),widths=columns.map(c=>Math.floor(this.w*(c.weight||1)/total));
    if(this.visible(24)){this.ui.ctx.fillStyle=T.face;this.ui.ctx.fillRect(this.x,this.y,this.w,23);let x=this.x;columns.forEach((c,i)=>{this.ui.text(fit(this.ui,c.label,widths[i]-12),x+6,this.y+5,T.ink);x+=widths[i];});}this.y+=24;
    this.rows(rows,(row,i)=>{if(this.visible(24)){const ctx=this.ui.ctx;ctx.fillStyle=row.selected?T.selected:i%2?T.row:T.paper;ctx.fillRect(this.x,this.y,this.w,24);let x=this.x;row.cells.forEach((value,j)=>{const text=fit(this.ui,value,widths[j]-12),px=numeric(value)?x+widths[j]-widthOf(this.ui,text)-6:x+6;this.ui.text(text,px,this.y+4,row.color||T.ink);x+=widths[j];});this.ui.regions.push({x:this.x,y:this.y,w:this.w,h:24,label:row.cells.map((v,j)=>`${columns[j]?.label}: ${v}`).join(' · '),onClick:row.click});}},24);this.space(5);
  }
  disclosure(label,open,click){this.button(`${open?'−':'+'} ${label}`,click,open);}
}
