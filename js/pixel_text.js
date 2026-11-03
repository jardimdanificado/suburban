// Canvas text is normally drawn with partially transparent edge pixels. Turn
// its glyph mask into opaque pixels so text stays crisp on pixel-art surfaces.
export function drawPixelText(ctx,text,x,y,maxWidth){
  const value=String(text),fontSize=Number.parseFloat(/([\d.]+)px/.exec(ctx.font)?.[1]||'16'),width=Math.max(1,Math.ceil(Math.min(maxWidth??ctx.measureText(value).width+4,ctx.canvas.width))),height=Math.max(1,Math.ceil(fontSize*1.8+6)),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const mask=canvas.getContext('2d');mask.font=ctx.font;mask.textAlign=ctx.textAlign;mask.textBaseline=ctx.textBaseline;mask.direction=ctx.direction;mask.fillStyle='#fff';
  const align=ctx.textAlign==='center'?width/2:['right','end'].includes(ctx.textAlign)?width-2:2,baseline=ctx.textBaseline==='middle'?height/2:['top','hanging'].includes(ctx.textBaseline)?2:ctx.textBaseline==='bottom'||ctx.textBaseline==='ideographic'?height-2:Math.min(height-2,fontSize+2);
  if(maxWidth==null)mask.fillText(value,align,baseline);else mask.fillText(value,align,baseline,maxWidth);
  const pixels=mask.getImageData(0,0,canvas.width,canvas.height),data=pixels.data;
  for(let i=0;i<data.length;i+=4){if(data[i+3]>=144){data[i]=data[i+1]=data[i+2]=255;data[i+3]=255;}else data[i+3]=0;}
  mask.putImageData(pixels,0,0);mask.globalCompositeOperation='source-in';mask.fillStyle=ctx.fillStyle;mask.fillRect(0,0,canvas.width,canvas.height);
  const left=ctx.textAlign==='center'?x-width/2:['right','end'].includes(ctx.textAlign)?x-width+2:x-2;ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(canvas,left,y-baseline);ctx.restore();
}
