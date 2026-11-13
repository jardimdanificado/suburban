// Match the existing bilinear tile tint using the final Float32 root positions.
export function grassRootTints(roots,{colors,width,minTx,minTy,base}){
  const tints=new Float32Array(roots.length);
  for(let i=0;i<roots.length;i+=3){
    const x=roots[i]-.5,z=roots[i+2]-.5,tx=Math.floor(x),tz=Math.floor(z),u=x-tx,v=z-tz;
    const a=u*u*(3-2*u),b=v*v*(3-2*v),w00=(1-a)*(1-b),w10=a*(1-b),w01=(1-a)*b,w11=a*b;
    const p=((tz-minTy+1)*width+tx-minTx+1)*3,p10=p+3,p01=p+width*3,p11=p01+3;
    for(let c=0;c<3;c++)tints[i+c]=(colors[p+c]*w00+colors[p10+c]*w10+colors[p01+c]*w01+colors[p11+c]*w11)*.82/base[c];
  }
  return tints;
}
