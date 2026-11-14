/** Smooth coincident corners without joining creases or opposite cloth linings.
 * Normal derivatives use the same weights, preserving animated skirt lighting.
 */
export function smoothCitizenNormals(positions,normals,derivatives=[]){
  const groups=new Map(),result=new Float32Array(normals.length),changes=derivatives.map(values=>new Float32Array(values.length));
  const key=i=>`${Math.round(positions[i]*1e6)},${Math.round(positions[i+1]*1e6)},${Math.round(positions[i+2]*1e6)}`;
  for(let i=0;i<positions.length;i+=3){const id=key(i),group=groups.get(id)||[];group.push(i);groups.set(id,group);}
  for(let i=0;i<positions.length;i+=3){
    const sum=[0,0,0],delta=derivatives.map(()=>[0,0,0]);
    for(const j of groups.get(key(i))){
      const dot=normals[i]*normals[j]+normals[i+1]*normals[j+1]+normals[i+2]*normals[j+2];
      if(dot<.25)continue;
      for(let axis=0;axis<3;axis++){sum[axis]+=normals[j+axis];for(let d=0;d<derivatives.length;d++)delta[d][axis]+=derivatives[d][j+axis];}
    }
    const length=Math.hypot(...sum)||1;
    for(let axis=0;axis<3;axis++){result[i+axis]=sum[axis]/length;for(let d=0;d<derivatives.length;d++)changes[d][i+axis]=delta[d][axis]/length;}
  }
  return {normals:result,derivatives:changes};
}
