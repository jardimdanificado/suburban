/** Shallow relief from the visible surface, with wrapped smoothing to suppress pixel-grid lighting. */
export function terrainSurfaceNormals(rgba,width,height,strength=.45){
 const heights=new Float32Array(width*height),smooth=new Float32Array(width*height),result=new Uint8ClampedArray(width*height*4);
 const index=(x,y)=>((y+height)%height)*width+(x+width)%width;
 for(let i=0;i<heights.length;i++)heights[i]=(.299*rgba[i*4]+.587*rgba[i*4+1]+.114*rgba[i*4+2])/255;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  let sum=0;for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++)sum+=heights[index(x+ox,y+oy)]*(ox===0?2:1)*(oy===0?2:1);
  smooth[index(x,y)]=sum/16;
 }
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const dx=(smooth[index(x+1,y-1)]+2*smooth[index(x+1,y)]+smooth[index(x+1,y+1)]-smooth[index(x-1,y-1)]-2*smooth[index(x-1,y)]-smooth[index(x-1,y+1)])*strength/4;
  const dy=(smooth[index(x-1,y+1)]+2*smooth[index(x,y+1)]+smooth[index(x+1,y+1)]-smooth[index(x-1,y-1)]-2*smooth[index(x,y-1)]-smooth[index(x+1,y-1)])*strength/4;
  const length=Math.hypot(dx,dy,1),p=index(x,y)*4;
  result[p]=(-dx/length*.5+.5)*255;result[p+1]=(-dy/length*.5+.5)*255;result[p+2]=(1/length*.5+.5)*255;result[p+3]=255;
 }
 return result;
}
