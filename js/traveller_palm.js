import {vegetationColor,foliageColor} from './vegetation_color.js';
// Ravenala: long petioles and banana-shaped paddles radiate in one vertical
// plane. It has neither a radial coconut crown nor palmate, fingered leaves.
export function travellerPalmSurface(){
  const positions=[],colors=[],uvs=[];
  const barkDark=vegetationColor(0x766747),barkLight=vegetationColor(0x968052),petiole=vegetationColor(0x648a2f),leafColor=foliageColor(0x478d32);
  const triangle=(a,b,c,color,uv=[[0,0],[1,0],[.5,1]])=>{positions.push(...a,...b,...c);colors.push(...color,...color,...color);uvs.push(...uv.flat());};
  const tube=(a,b,r,color,sides=5)=>{
    const delta=b.map((v,i)=>v-a[i]),length=Math.hypot(...delta),axis=delta.map(v=>v/length);
    let u=[axis[1],-axis[0],0];if(Math.hypot(...u)<.01)u=[1,0,0];const norm=Math.hypot(...u);u=u.map(v=>v/norm);
    const v=[axis[1]*u[2]-axis[2]*u[1],axis[2]*u[0]-axis[0]*u[2],axis[0]*u[1]-axis[1]*u[0]];
    const point=(p,i)=>p.map((value,j)=>value+r*(u[j]*Math.cos(i/sides*Math.PI*2)+v[j]*Math.sin(i/sides*Math.PI*2)));
    for(let i=0;i<sides;i++){triangle(point(a,i),point(b,i),point(b,i+1),color);triangle(point(a,i),point(b,i+1),point(a,i+1),color);}
  };
  for(let ring=0;ring<8;ring++)tube([0,ring*.18,0],[0,(ring+1)*.18,0],.14-ring*.005,ring%2?barkDark:barkLight,7);
  for(let leaf=0;leaf<15;leaf++){
    const angle=(leaf-7)/7*1.28,dx=Math.sin(angle),dy=Math.cos(angle),sx=dy,sy=-dx;
    const stemLength=1.18+(leaf%3)*.09,leafLength=1.25+(1-Math.abs(leaf-7)/7)*.34;
    const origin=[(leaf%2?.018:-.018),1.25+leaf%3*.025,0];
    const point=(along,across=0,depth=0)=>[origin[0]+dx*along+sx*across,origin[1]+dy*along+sy*across,depth];
    tube(origin,point(stemLength+leafLength*.94,0,.015),.016,petiole,4);
    for(let segment=0;segment<7;segment++){
      const section=t=>{
        const width=Math.pow(Math.sin(Math.PI*t),.55)*(.22+(leaf%3)*.018),along=stemLength+t*leafLength;
        // Small opposing tears preserve the broad paddle silhouette.
        const tear=segment%3===1?.79:1;
        return [point(along,-width*tear,-.025),point(along,0,.035*Math.sin(t*Math.PI)),point(along,width,-.025)];
      };
      const a=section(segment/7),b=section((segment+1)/7),tone=.82+(leaf%4)*.055;
      for(let half=0;half<2;half++){
        const color=leafColor.map(channel=>channel*tone);
        triangle(a[half],b[half],b[half+1],color);triangle(a[half],b[half+1],a[half+1],color);
      }
    }
  }
  return {positions,colors,uvs};
}
export function createTravellerPalmGeometry(THREE){
  const data=travellerPalmSurface(),geometry=new THREE.BufferGeometry();
  for(const [key,array,size]of [['position',data.positions,3],['color',data.colors,3],['uv',data.uvs,2]])geometry.setAttribute(key,new THREE.Float32BufferAttribute(array,size));
  geometry.computeVertexNormals();return geometry;
}
