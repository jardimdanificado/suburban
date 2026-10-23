import { MANAGEMENT_THEME as T, bevel } from './management_ui.js';

export const UI_COLORS = { gold:T.gold, gray:T.ink, muted:T.muted, green:T.green, red:T.red, cyan:T.blue, pink:'#86556d', surface:T.paper, line:T.line, ink:T.ink };
export const fitText = (value,width,scale=1) => {const s=String(value??''),n=Math.max(0,Math.floor(width/(7*scale)));return s.length<=n?s:n>3?s.slice(0,n-3)+'…':s.slice(0,n);};
const C=UI_COLORS;
const widthOf=(ui,text)=>ui.textWidth?ui.textWidth(text):String(text).length*8;

/** Shared readable, measured layouts for the management windows. */
export class UIPage {
  constructor(ui,x,y,w,top,bottom){Object.assign(this,{ui,x,y,w,top,bottom});}
  space(h=8){this.y+=h;}
  visible(h){return this.y+h>this.top&&this.y<this.bottom;}
  heading(value,color=T.ink){
    this.space(8);
    if(this.visible(16)){this.ui.text(fitText(value,this.w),this.x,this.y,color===C.gold?T.ink:color);this.ui.ctx.fillStyle=T.line;this.ui.ctx.fillRect(this.x,this.y+17,this.w,1);}
    this.y+=26;
  }
  note(value,color=T.muted){
    const max=Math.max(1,Math.floor(this.w/7));
    for(const paragraph of String(value??'').split('\n')){
      let line='';
      for(let word of paragraph.split(' ')){
        if(widthOf(this.ui,line+(line?' ':'')+word)>this.w&&line){this.line(line,color);line='';}
        while(widthOf(this.ui,word)>this.w&&word.length>max){if(line){this.line(line,color);line='';}this.line(word.slice(0,max),color);word=word.slice(max);}
        line+=(line?' ':'')+word;
      }
      this.line(line,color);
    }
    this.space(4);
  }
  line(value,color){if(this.visible(16))this.ui.text(value,this.x,this.y,color);this.y+=16;}
  kv(label,value){
    const narrow=widthOf(this.ui,label)+widthOf(this.ui,value)+30>this.w,h=narrow?36:24;
    if(this.visible(h)){
      this.ui.text(fitText(label,this.w-12),this.x+2,this.y+5,T.muted);
      this.ui.text(fitText(value,this.w-12),narrow?this.x+2:this.x+this.w-widthOf(this.ui,value)-4,this.y+(narrow?20:5),T.ink);
      this.ui.ctx.fillStyle=T.line;this.ui.ctx.fillRect(this.x,this.y+h-3,this.w,1);
    }
    this.y+=h;
  }
  button(label,click,selected=false){if(this.visible(24))this.ui.button(this.x,this.y,this.w,24,fitText(label,this.w-20),click,{selected});this.y+=30;}
  buttons(items){
    let dx=0;
    for(const item of items){const w=Math.min(this.w,item.label.length*7+22);if(dx&&dx+w>this.w){dx=0;this.y+=26;}
      if(this.visible(24))this.ui.button(this.x+dx,this.y,w,24,fitText(item.label,w-20),item.click,{selected:item.selected});dx+=w+4;
    }
    this.y+=30;
  }
  card(title,subtitle,click,selected,color=T.blue){
    const lines=String(subtitle??'').split('\n'),h=26+lines.length*16;
    if(this.visible(h)){
      const ctx=this.ui.ctx;ctx.fillStyle=selected?T.selected:T.paper;ctx.fillRect(this.x,this.y,this.w,h);ctx.strokeStyle=selected?T.header:T.line;ctx.lineWidth=1;ctx.strokeRect(this.x+.5,this.y+.5,this.w-1,h-1);
      this.ui.text(fitText(title,this.w-36),this.x+7,this.y+5,T.ink);ctx.fillStyle=color;ctx.fillRect(this.x+this.w-17,this.y+12,5,5);
      for(const [i,line]of lines.entries())this.ui.text(fitText(line,this.w-20),this.x+7,this.y+23+i*16,T.muted);
      this.ui.regions.push({x:this.x,y:this.y,w:this.w,h,label:title,onClick:click});
    }
    this.y+=h+3;
  }
  meter(label,value,color){
    const pct=Math.max(0,Math.min(100,Number(value)||0));
    if(this.visible(26)){
      const ctx=this.ui.ctx,fill=color||(pct<30?T.red:pct<65?T.gold:T.green),amount=`${Math.round(pct)}%`;
      this.ui.text(fitText(label,this.w-50),this.x,this.y,T.ink);this.ui.text(amount,this.x+this.w-widthOf(this.ui,amount),this.y,fill);
      bevel(ctx,this.x,this.y+17,this.w,12,{inset:true,fill:T.track});ctx.fillStyle=fill;ctx.fillRect(this.x+2,this.y+19,Math.max(0,this.w-4)*pct/100,8);
    }
    this.y+=36;
  }
  meters(items){
    const cols=this.w>=400?2:1,gap=14,cw=Math.floor((this.w-(cols-1)*gap)/cols);
    for(let i=0;i<items.length;i+=cols){for(let j=0;j<cols&&i+j<items.length;j++){const p=new UIPage(this.ui,this.x+j*(cw+gap),this.y,cw,this.top,this.bottom);p.meter(...items[i+j]);}this.y+=38;}
  }
  metrics(items){
    const cols=this.w>=560&&items.length%4===0?4:this.w>=560&&items.length%3===0?3:2,gap=6,cw=Math.floor((this.w-gap*(cols-1))/cols);
    for(let i=0;i<items.length;i+=cols){
      if(this.visible(68))for(let j=0;j<cols&&i+j<items.length;j++){
        const[label,value,color=T.ink,hint='',click]=items[i+j],x=this.x+j*(cw+gap);
        bevel(this.ui.ctx,x,this.y,cw,68,{inset:true,fill:T.paper});this.ui.text(fitText(label,cw-20),x+10,this.y+6,T.muted);
        const scale=String(value).length*13<=cw-20?2:1;this.ui.text(fitText(value,cw-20,scale),x+10,this.y+24,color===T.red?T.red:T.ink,scale);
        this.ui.text(fitText(hint,cw-20),x+10,this.y+49,T.muted);if(click)this.ui.regions.push({x,y:this.y,w:cw,h:68,label,onClick:click});
      }
      this.y+=74;
    }
  }
  columns(left,right){
    if(this.w<680){left(this);right(this);return;}const gap=16,width=Math.floor((this.w-gap)/2),a=new UIPage(this.ui,this.x,this.y,width,this.top,this.bottom),b=new UIPage(this.ui,this.x+width+gap,this.y,this.w-width-gap,this.top,this.bottom);left(a);right(b);this.y=Math.max(a.y,b.y);
  }
  table(columns,rows,{empty='Nenhum registro encontrado.'}={}){
    if(!rows.length){this.note(empty);return;}
    if(this.w<520){for(const row of rows){if(row.click)this.card(row.cells[0],row.cells.slice(1).map((v,i)=>`${columns[i+1].label}: ${v}`).join('\n'),row.click,row.selected,row.color);else{this.heading(row.cells[0]);for(let i=1;i<row.cells.length;i++)this.kv(columns[i].label,row.cells[i]);}}return;}
    const total=columns.reduce((n,c)=>n+(c.weight||1),0),widths=columns.map(c=>Math.floor(this.w*(c.weight||1)/total));
    if(this.visible(24)){let x=this.x;columns.forEach((c,i)=>{bevel(this.ui.ctx,x,this.y,widths[i],23);const label=fitText(c.label,widths[i]-14),numeric=rows.every(r=>typeof r.cells[i]==='number'||/^R\$|^\d+[%,]/.test(String(r.cells[i])));this.ui.text(label,numeric?x+widths[i]-widthOf(this.ui,label)-8:x+7,this.y+7,T.ink);x+=widths[i];});}this.y+=24;
    for(const[i,row]of rows.entries()){
      if(this.visible(26)){
        const ctx=this.ui.ctx;ctx.fillStyle=row.selected?T.selected:i%2?T.row:T.paper;ctx.fillRect(this.x,this.y,this.w,25);
        let x=this.x;row.cells.forEach((v,j)=>{const text=fitText(v,widths[j]-16),numeric=typeof v==='number'||/^R\$|^\d+[%,]/.test(String(v)),px=numeric?x+widths[j]-widthOf(this.ui,text)-8:x+7;this.ui.text(text,px,this.y+6,row.color===T.red?T.red:T.ink);x+=widths[j];});
        if(row.click)this.ui.regions.push({x:this.x,y:this.y,w:this.w,h:25,label:row.cells[0],onClick:row.click});
      }
      this.y+=26;
    }
    this.space(8);
  }
  disclosure(label,open,click){this.button(`${open?'-':'+'} ${label}`,click,open);}
}
