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
  space(h=4){this.y+=h;}
  visible(h){return this.y+h>this.top&&this.y<this.bottom;}
  heading(value,color=T.ink){this.space(3);if(this.visible(16)){this.ui.text(fit(this.ui,value,this.w),this.x,this.y,color===T.gold?T.ink:color);this.ui.ctx.fillStyle=T.line;this.ui.ctx.fillRect(this.x,this.y+14,this.w,1);}this.y+=19;}
  line(value,color=T.muted){if(this.visible(14))this.ui.text(value,this.x,this.y,color);this.y+=14;}
  note(value,color=T.muted){const lines=wrapped(this.ui,value,this.w),start=this.y;const first=Math.max(0,Math.floor((this.top-start)/14)),last=Math.min(lines.length,Math.ceil((this.bottom-start)/14));for(let i=first;i<last;i++)this.ui.text(lines[i],this.x,start+i*14,color);this.y=start+lines.length*14+2;}
  block(title,subtitle,draw){
    const start=this.y,ctx=this.ui.ctx;
    if(this.visible(25)){ctx.fillStyle=T.face;ctx.fillRect(this.x,start,this.w,24);this.ui.text(fit(this.ui,title,this.w-20),this.x+10,start+5,T.ink);}
    const body=new UIPage(this.ui,this.x+10,start+30,this.w-20,this.top,this.bottom);
    if(subtitle)body.note(subtitle);draw(body);const end=body.y+8;
    if(end>this.top&&start<this.bottom){ctx.strokeStyle=T.line;ctx.strokeRect(this.x+.5,start+.5,this.w-1,end-start-1);}
    this.y=end+12;
  }
  kv(label,value){
    const text=String(value??''),wide=widthOf(this.ui,text)>this.w*.64,lines=wide?wrapped(this.ui,text,this.w-4):null,h=wide?18+lines.length*14:18;
    if(this.visible(h)){
      const valueWidth=Math.min(this.w*.64,widthOf(this.ui,text)),labelWidth=wide?this.w:this.w-valueWidth-10;
      this.ui.text(fit(this.ui,label,labelWidth),this.x+2,this.y+2,T.muted);
      if(wide){for(let i=0;i<lines.length;i++)if(this.y+16+i*14>=this.top-14&&this.y+16+i*14<this.bottom)this.ui.text(lines[i],this.x+2,this.y+16+i*14,T.ink);}
      else this.ui.text(text,this.x+this.w-valueWidth-2,this.y+2,T.ink);
      this.ui.ctx.fillStyle=T.line;this.ui.ctx.fillRect(this.x,this.y+h-1,this.w,1);
      this.ui.regions.push({x:this.x,y:this.y,w:this.w,h,label:`${label}: ${text}`,onClick:null});
    }this.y+=h;
  }
  button(label,click,selected=false){if(this.visible(20))this.ui.button(this.x,this.y,this.w,20,fit(this.ui,label,this.w-12),click,{selected});this.y+=23;}
  buttons(items){let dx=0;for(const item of items){const w=Math.min(this.w,Math.ceil(widthOf(this.ui,item.label))+14);if(dx&&dx+w>this.w){dx=0;this.y+=23;}if(this.visible(20))this.ui.button(this.x+dx,this.y,w,20,fit(this.ui,item.label,w-10),item.click,{selected:item.selected});dx+=w+3;}this.y+=23;}
  // Related views stay visible as compact tabs inside their current window.
  links(items){
    if(!items.length)return;
    const state=this.ui.windowState;if(state?.host){state.windowLinks??=[];state.windowLinks.push(...items);}
    if(!items.some(item=>'selected' in item||'current' in item)){this.buttons(items);return;}
    let dx=0;const ctx=this.ui.ctx;
    for(const item of items){
      const w=Math.min(this.w,Math.ceil(widthOf(this.ui,item.label))+18),selected=!!(item.current??item.selected);
      if(dx&&dx+w>this.w){dx=0;this.y+=21;}
      if(this.visible(19)){
        ctx.fillStyle=selected?T.selected:T.face;ctx.fillRect(this.x+dx,this.y,w-2,19);
        ctx.fillStyle=selected?T.blue:T.line;ctx.fillRect(this.x+dx,this.y+17,w-2,selected?2:1);
        this.ui.text(fit(this.ui,item.label,w-14),this.x+dx+7,this.y+3,selected?T.blue:T.ink);
        this.ui.regions.push({x:this.x+dx,y:this.y,w:w-2,h:19,label:item.label,onClick:item.click});
      }dx+=w;
    }this.y+=23;
  }
  status(title,description='',color=T.blue,click=null){
    const start=this.y,lines=description?wrapped(this.ui,description,this.w-18):[],height=22+lines.length*14;
    if(this.visible(height)){
      const ctx=this.ui.ctx;ctx.fillStyle=T.row;ctx.fillRect(this.x,start,this.w,height);ctx.fillStyle=color;ctx.fillRect(this.x,start,3,height);
      this.ui.text(fit(this.ui,title,this.w-18),this.x+9,start+4,color);
      for(let i=0;i<lines.length;i++)if(start+20+i*14>=this.top-14&&start+20+i*14<this.bottom)this.ui.text(lines[i],this.x+9,start+20+i*14,T.ink);
      this.ui.regions.push({x:this.x,y:start,w:this.w,h:height,label:`${title}: ${description}`,onClick:click});
    }this.y+=height+5;
  }
  windowLink(label,click){this.button(label,click);}
  card(title,subtitle,click,selected,color=T.blue){const lines=String(subtitle??'').split('\n'),h=19+lines.length*14;if(this.visible(h)){const ctx=this.ui.ctx;ctx.fillStyle=selected?T.selected:T.paper;ctx.fillRect(this.x,this.y,this.w,h);ctx.fillStyle=T.line;ctx.fillRect(this.x,this.y+h-1,this.w,1);this.ui.text(fit(this.ui,title,this.w-25),this.x+6,this.y+4,T.ink);ctx.fillStyle=color;ctx.fillRect(this.x+this.w-10,this.y+8,4,4);for(const[i,line]of lines.entries())this.ui.text(fit(this.ui,line,this.w-16),this.x+6,this.y+17+i*14,T.muted);this.ui.regions.push({x:this.x,y:this.y,w:this.w,h,label:`${title} — ${lines.join(' / ')}`,onClick:click});}this.y+=h+1;}
  record(title,subtitle,click,selected=false,{value='',color=T.blue}={}){
    const h=32;if(this.visible(h)){const ctx=this.ui.ctx;ctx.fillStyle=selected?T.selected:T.paper;ctx.fillRect(this.x,this.y,this.w,h-1);ctx.fillStyle=color;ctx.fillRect(this.x,this.y+5,3,h-12);ctx.fillStyle=T.line;ctx.fillRect(this.x,this.y+h-2,this.w,1);
      const right=fit(this.ui,value,this.w*.38),rw=right?widthOf(this.ui,right)+12:0;
      this.ui.text(fit(this.ui,title,this.w-16-rw),this.x+8,this.y+2,T.ink);if(right)this.ui.text(right,this.x+this.w-widthOf(this.ui,right)-4,this.y+2,color);
      this.ui.text(fit(this.ui,subtitle,this.w-16),this.x+8,this.y+17,T.muted);
      this.ui.regions.push({x:this.x,y:this.y,w:this.w,h:h-1,label:`${title} — ${subtitle}${value?' — '+value:''}`,onClick:click});
    }this.y+=h;
  }
  rows(items,draw,height=32){const start=this.y,first=Math.max(0,Math.floor((this.top-start)/height)),last=Math.min(items.length,Math.ceil((this.bottom-start)/height));for(let i=first;i<last;i++){this.y=start+i*height;draw(items[i],i);}this.y=start+items.length*height;}
  meter(label,value,color){const pct=Math.max(0,Math.min(100,Number(value)||0));if(this.visible(20)){const ctx=this.ui.ctx,fill=color||(pct<30?T.red:pct<65?T.gold:T.green),amount=`${Math.round(pct)}%`;this.ui.text(fit(this.ui,label,this.w-34),this.x,this.y,T.ink);this.ui.text(amount,this.x+this.w-widthOf(this.ui,amount),this.y,fill);ctx.fillStyle=T.track;ctx.fillRect(this.x,this.y+14,this.w,4);ctx.fillStyle=fill;ctx.fillRect(this.x,this.y+14,this.w*pct/100,4);}this.y+=22;}
  meters(items){const cols=this.w>=580?3:this.w>=300?2:1,gap=10,cw=Math.floor((this.w-(cols-1)*gap)/cols);for(let i=0;i<items.length;i+=cols){for(let j=0;j<cols&&i+j<items.length;j++){const page=new UIPage(this.ui,this.x+j*(cw+gap),this.y,cw,this.top,this.bottom);page.meter(...items[i+j]);}this.y+=22;}}
  metrics(items){const cols=this.w>=480&&items.length%4===0?4:this.w>=480&&items.length%3===0?3:2,gap=4,cw=Math.floor((this.w-gap*(cols-1))/cols);for(let i=0;i<items.length;i+=cols){const h=items.slice(i,i+cols).some(item=>item[3])?51:39;if(this.visible(h))for(let j=0;j<cols&&i+j<items.length;j++){const[label,value,color=T.ink,hint='',click]=items[i+j],x=this.x+j*(cw+gap),ctx=this.ui.ctx;ctx.fillStyle=T.row;ctx.fillRect(x,this.y,cw,h-4);this.ui.text(fit(this.ui,label,cw-12),x+6,this.y+3,T.muted);const scale=widthOf(this.ui,value)*1.5<=cw-12?2:1;this.ui.text(fit(this.ui,value,cw-12,scale),x+6,this.y+17,color===T.gold?T.ink:color,scale);if(hint)this.ui.text(fit(this.ui,hint,cw-12),x+6,this.y+35,T.muted);if(click)this.ui.regions.push({x,y:this.y,w:cw,h:h-4,label,onClick:click});}this.y+=h;}}
  columns(left,right){if(this.w<520){left(this);right(this);return;}const gap=10,width=Math.floor((this.w-gap)/2),a=new UIPage(this.ui,this.x,this.y,width,this.top,this.bottom),b=new UIPage(this.ui,this.x+width+gap,this.y,this.w-width-gap,this.top,this.bottom);left(a);right(b);this.y=Math.max(a.y,b.y);}
  table(columns,rows,{empty='Nenhum registro encontrado.'}={}){
    if(!rows.length){this.note(empty);return;}
    const total=columns.reduce((n,c)=>n+(c.weight||1),0),widths=columns.map(c=>Math.floor(this.w*(c.weight||1)/total));
    if(this.w<300||Math.min(...widths)<48){
      const height=24+(columns.length-1)*14;
      this.rows(rows,row=>{
        if(!this.visible(height))return;
        const ctx=this.ui.ctx;ctx.fillStyle=row.selected?T.selected:T.row;ctx.fillRect(this.x,this.y,this.w,height-3);
        this.ui.text(fit(this.ui,row.cells[0],this.w-12),this.x+6,this.y+3,row.color||T.ink);
        for(let j=1;j<columns.length;j++){
          const label=fit(this.ui,columns[j].label,this.w*.42-8),value=fit(this.ui,row.cells[j],this.w*.58-12);
          this.ui.text(label,this.x+6,this.y+20+(j-1)*14,T.muted);this.ui.text(value,this.x+this.w-widthOf(this.ui,value)-6,this.y+20+(j-1)*14,T.ink);
        }
        this.ui.regions.push({x:this.x,y:this.y,w:this.w,h:height-3,label:row.cells.map((v,j)=>`${columns[j]?.label}: ${v}`).join(' · '),onClick:row.click});
      },height);this.space(3);return;
    }
    if(this.visible(19)){this.ui.ctx.fillStyle=T.face;this.ui.ctx.fillRect(this.x,this.y,this.w,19);let x=this.x;columns.forEach((c,i)=>{this.ui.text(fit(this.ui,c.label,widths[i]-12),x+6,this.y+3,T.ink);x+=widths[i];});}this.y+=20;
    this.rows(rows,(row,i)=>{if(this.visible(19)){const ctx=this.ui.ctx;ctx.fillStyle=row.selected?T.selected:i%2?T.row:T.paper;ctx.fillRect(this.x,this.y,this.w,19);let x=this.x;row.cells.forEach((value,j)=>{const text=fit(this.ui,value,widths[j]-12),px=numeric(value)?x+widths[j]-widthOf(this.ui,text)-6:x+6;this.ui.text(text,px,this.y+3,row.color||T.ink);x+=widths[j];});this.ui.regions.push({x:this.x,y:this.y,w:this.w,h:19,label:row.cells.map((v,j)=>`${columns[j]?.label}: ${v}`).join(' · '),onClick:row.click});}},19);this.space(3);
  }
  disclosure(label,open,click){this.button(`${open?'−':'+'} ${label}`,click,open);}
}
