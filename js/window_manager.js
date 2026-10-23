/** Floating, ordered windows. Coordinates are CSS pixels, independent of render resolution. */
export class WindowManager {
  constructor({width=1100,height=800,top=34,bottom=30,snap=10}={}){Object.assign(this,{width,height,top,bottom,snap});this.windows=[];this.saved=new Map();this.gesture=null;this.activeId=null;}
  get active(){return this.windows.find(w=>w.id===this.activeId);}
  find(id){return this.windows.find(w=>w.id===id);}
  viewport(width,height){this.width=width;this.height=height;for(const w of this.windows){if(w.maximized)Object.assign(w,{x:4,y:this.top,w:width-8,h:height-this.top-this.bottom});this.constrain(w);}}
  open({id,title='',width=500,height=480,minWidth=300,minHeight=200,state=null,near=null}={}){
    let w=this.find(id);if(w){this.raise(id);return w;}
    const saved=this.saved.get(id),n=this.windows.length;
    w={id,title,x:18+(n%7)*28,y:this.top+14+(n%6)*26,w:width,h:height,minWidth,minHeight,state,pinned:false,shaded:false,maximized:false,...saved};
    if(!saved&&near){w.x=near.x+near.w+12;w.y=near.y+20;if(w.x+w.w>this.width)w.x=near.x+32;}
    this.constrain(w);this.windows.push(w);this.activeId=id;return w;
  }
  raise(id){const i=this.windows.findIndex(w=>w.id===id);if(i<0)return;const[w]=this.windows.splice(i,1);this.windows.push(w);this.activeId=id;return w;}
  close(id){const w=this.find(id);if(!w)return null;this.saved.set(id,{x:w.x,y:w.y,w:w.w,h:w.h,pinned:w.pinned});this.windows.splice(this.windows.indexOf(w),1);if(this.activeId===id)this.activeId=this.windows.at(-1)?.id||null;if(this.gesture?.id===id)this.gesture=null;return w;}
  closeAll(includePinned=false){return [...this.windows].filter(w=>includePinned||!w.pinned).map(w=>this.close(w.id));}
  rect(w){return{x:w.x,y:w.y,w:w.w,h:w.shaded?26:w.h};}
  at(x,y){return [...this.windows].reverse().find(w=>{const r=this.rect(w);return x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h;});}
  caption(w,x,y){return y>=w.y&&y<w.y+26&&x>=w.x+26&&x<w.x+w.w-78;}
  constrain(w){
    const maxW=Math.max(180,this.width-8),maxH=Math.max(110,this.height-this.top-this.bottom-6);
    w.w=Math.min(maxW,Math.max(Math.min(w.minWidth,maxW),w.w));w.h=Math.min(maxH,Math.max(Math.min(w.minHeight,maxH),w.h));
    w.x=Math.max(4,Math.min(this.width-w.w-4,w.x));w.y=Math.max(this.top,Math.min(this.height-this.bottom-(w.shaded?26:w.h),w.y));return w;
  }
  pointerDown(x,y){
    const w=this.at(x,y);if(!w)return false;this.raise(w.id);
    const resize=!w.shaded&&x>=w.x+w.w-18&&y>=w.y+w.h-18;
    if(!resize&&!this.caption(w,x,y))return false;
    if(w.maximized)return false;
    this.gesture={id:w.id,kind:resize?'resize':'move',x,y,start:{x:w.x,y:w.y,w:w.w,h:w.h}};return true;
  }
  pointerMove(x,y){
    const g=this.gesture,w=g&&this.find(g.id);if(!w)return false;const dx=x-g.x,dy=y-g.y;
    if(g.kind==='resize'){w.w=g.start.w+dx;w.h=g.start.h+dy;}
    else {w.x=g.start.x+dx;w.y=g.start.y+dy;this.snapWindow(w);}
    this.constrain(w);return true;
  }
  pointerUp(){const active=!!this.gesture;this.gesture=null;return active;}
  snapWindow(w){
    const xs=[4,this.width-w.w-4],ys=[this.top,this.height-this.bottom-w.h];
    for(const other of this.windows){if(other===w)continue;const r=this.rect(other);if(w.y<r.y+r.h+this.snap&&w.y+w.h>r.y-this.snap)xs.push(r.x+r.w+2,r.x-w.w-2,r.x,r.x+r.w-w.w);if(w.x<r.x+r.w+this.snap&&w.x+w.w>r.x-this.snap)ys.push(r.y+r.h+2,r.y-w.h-2,r.y,r.y+r.h-w.h);}
    const closest=(n,values)=>values.reduce((best,v)=>Math.abs(v-n)<Math.abs(best-n)?v:best,n+this.snap+1);
    const x=closest(w.x,xs),y=closest(w.y,ys);if(Math.abs(x-w.x)<=this.snap)w.x=x;if(Math.abs(y-w.y)<=this.snap)w.y=y;
  }
  shade(id){const w=this.find(id);if(w){w.shaded=!w.shaded;this.constrain(w);}return w;}
  maximize(id){const w=this.find(id);if(!w)return;if(w.maximized){Object.assign(w,w.restore);w.maximized=false;delete w.restore;}else{w.restore={x:w.x,y:w.y,w:w.w,h:w.h};w.maximized=true;w.shaded=false;Object.assign(w,{x:4,y:this.top,w:this.width-8,h:this.height-this.top-this.bottom});}this.constrain(w);}
  pin(id){const w=this.find(id);if(w)w.pinned=!w.pinned;return w;}
  cascade(){let n=0;for(const w of this.windows){if(w.pinned)continue;w.maximized=false;w.shaded=false;w.x=12+(n%9)*28;w.y=this.top+10+(n%7)*28;this.constrain(w);n++;}}
}
