export function addBuildingRoof(THREE,facade,b,material,kind,baseY){
  if(kind==='gable'){
    const triangle=new THREE.Shape();triangle.moveTo(-b.width/2-.1,0);triangle.lineTo(b.width/2+.1,0);triangle.lineTo(0,.75);triangle.closePath();
    const pitched=new THREE.Mesh(new THREE.ExtrudeGeometry(triangle,{depth:b.depth+.2,bevelEnabled:false}),material);pitched.position.set(b.width/2,baseY,-.1);pitched.castShadow=true;facade.add(pitched);return;
  }
  if(kind==='hip'){
    const geometry=new THREE.ConeGeometry(1,.75,4);geometry.rotateY(Math.PI/4);
    const pitched=new THREE.Mesh(geometry,material);
    pitched.scale.set((b.width+.2)/Math.SQRT2,1,(b.depth+.2)/Math.SQRT2);pitched.position.set(b.width/2,baseY+.375,b.depth/2);pitched.castShadow=true;facade.add(pitched);return;
  }
  if(kind==='mansard'){
    const lowerGeo=new THREE.CylinderGeometry(.62,1,.42,4);lowerGeo.rotateY(Math.PI/4);
    const lower=new THREE.Mesh(lowerGeo,material);
    lower.scale.set((b.width+.2)/Math.SQRT2,1,(b.depth+.2)/Math.SQRT2);lower.position.set(b.width/2,baseY+.21,b.depth/2);lower.castShadow=true;facade.add(lower);
    const upperGeo=new THREE.ConeGeometry(.62,.42,4);upperGeo.rotateY(Math.PI/4);
    const upper=new THREE.Mesh(upperGeo,material);
    upper.scale.set((b.width+.2)/Math.SQRT2,1,(b.depth+.2)/Math.SQRT2);upper.position.set(b.width/2,baseY+.63,b.depth/2);upper.castShadow=true;facade.add(upper);return;
  }
  if(kind==='shed'){
    const roof=new THREE.Mesh(new THREE.BoxGeometry(b.width+.2,.16,b.depth+.28),material);roof.rotation.x=.18;
    roof.position.set(b.width/2,baseY+.34,b.depth/2);roof.castShadow=true;facade.add(roof);return;
  }
  material.dispose();
}
