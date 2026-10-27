/** Small pixel icons drawn locally, in the style of classic transport-management toolbars. */
export function tycoonIcon(ctx,key,x,y,scale=2){
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
  const rect=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);},line=(points,c)=>{ctx.strokeStyle=c;ctx.lineWidth=1;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x+.5,y+.5):ctx.moveTo(x+.5,y+.5));ctx.stroke();};
  const ink='#293438',light='#f4ebc5',blue='#527cb3',dark='#714f30',brick='#b57448',green='#659453';
  if(key==='elections'){rect(2,7,12,7,blue);rect(5,8,6,1,ink);rect(5,1,7,5,light);line([[6,2],[9,5],[11,2]],dark);rect(7,5,2,3,light);}
  else if(key==='politics'){rect(2,8,12,6,dark);rect(3,9,10,4,light);for(let i=0;i<3;i++)rect(3+i*4,4,2,3,blue);rect(7,0,2,3,'#d6b169');}
  else if(key==='current'){rect(1,1,14,13,blue);rect(2,4,12,9,light);rect(3,2,7,1,'#e7bd59');rect(4,6,7,1,dark);rect(4,9,5,1,dark);}
  else if(['city','buildings','government'].includes(key)){
    rect(2,6,12,8,dark);rect(3,7,10,6,key==='government'?'#d6c797':brick);rect(5,2,6,12,key==='city'?blue:light);rect(6,3,4,2,dark);rect(7,11,2,3,ink);
    for(const i of[0,1])for(const j of[0,1])rect(3+i*8,8+j*3,2,1,light);if(key==='government'){line([[1,5],[8,1],[15,5]],dark);rect(7,0,1,3,ink);rect(8,0,4,2,'#c64b3c');}
  }else if(key==='people'){
    rect(3,3,4,4,'#e0b779');rect(3,2,4,1,dark);rect(2,7,6,6,blue);rect(3,13,2,2,ink);rect(6,13,2,2,ink);rect(10,4,3,3,'#e0b779');rect(9,7,5,6,'#9d5555');rect(10,13,2,2,ink);rect(13,13,1,2,ink);
  }else if(key==='land'){
    rect(1,2,14,12,dark);for(const xx of[2,8])for(const yy of[3,8])rect(xx,yy,5,4,'#b3bd70');
  }else if(key==='center'){
    rect(7,1,2,14,blue);rect(1,7,14,2,blue);rect(4,4,8,8,ink);rect(5,5,6,6,light);rect(7,7,2,2,'#c4553d');
  }else if(key==='map'){
    rect(1,2,14,12,green);rect(2,3,12,10,'#a5bd70');line([[3,5],[7,8],[11,4],[14,8]],blue);line([[4,3],[4,13]],dark);line([[10,3],[10,13]],dark);line([[2,9],[14,9]],dark);
  }else if(key==='market'){
    rect(1,11,3,4,blue);rect(6,7,3,8,green);rect(11,3,3,12,brick);line([[1,8],[6,4],[10,6],[14,1]],ink);rect(1,1,4,4,'#e5c64b');
  }else if(key==='economy'||key==='production'){
    rect(1,7,14,7,brick);rect(3,2,2,8,dark);rect(10,1,2,9,dark);rect(4,1,3,1,'#c3c6ba');rect(11,0,3,1,'#c3c6ba');for(const p of[2,6,10])rect(p,9,3,3,light);if(key==='production'){rect(6,4,1,9,'#e5c64b');line([[4,5],[6,7],[9,4]],'#f4d56a');}
  }else if(key==='transport'){
    rect(1,6,9,6,blue);rect(10,8,4,4,brick);rect(11,6,2,3,light);rect(2,12,3,3,ink);rect(10,12,3,3,ink);rect(3,13,1,1,'#c8c9bc');rect(11,13,1,1,'#c8c9bc');
  }else if(key==='sanitation'){
    rect(4,6,9,8,'#6496ac');rect(3,5,11,2,light);rect(6,2,5,3,light);rect(6,8,2,4,'#a0c9d6');rect(11,8,1,4,ink);line([[1,13],[3,8],[3,4]],green);
  }else if(key==='publications'){
    rect(1,3,6,11,blue);rect(8,3,6,11,dark);rect(2,2,5,10,light);rect(8,2,5,10,light);rect(7,3,1,11,ink);for(const y of[4,7,10]){rect(3,y,3,1,dark);rect(9,y,3,1,dark);}
  }else if(key==='corruption'){
    rect(2,2,9,11,dark);rect(3,3,7,9,light);for(const y of[5,8])rect(4,y,5,1,ink);rect(9,7,5,5,blue);rect(10,8,3,3,light);line([[12,11],[15,15]],ink);
  }else if(key==='log'||key==='windows'){
    rect(2,2,12,12,dark);rect(3,3,10,10,light);for(const i of[5,8,11])rect(5,i,6,1,ink);if(key==='windows'){rect(0,0,11,9,blue);rect(1,2,9,6,light);}
  }else if(key==='settings'){
    for(const i of[3,7,11]){rect(1,i,14,2,ink);rect(i,i-2,3,6,'#b3b5a5');rect(i+1,i-1,1,4,light);}
  }else if(key==='pause'){rect(4,3,3,11,ink);rect(10,3,3,11,ink);}
  else if(key==='play'||key==='fast'){for(const offset of key==='fast'?[0,6]:[3])for(let i=0;i<6;i++)rect(offset+1+i,3+i/2,1,11-i,ink);}
  else if(key==='editor'){line([[2,13],[13,2]],ink);line([[3,14],[14,3]],'#d9b24c');rect(11,1,3,3,'#cb6f53');}
  else if(key==='3d'){rect(3,4,10,9,brick);line([[3,4],[8,1],[13,4],[8,7],[3,4]],light);line([[8,7],[8,14]],ink);}
  else if(key==='2d'){rect(2,3,12,10,green);rect(4,5,4,3,light);rect(10,4,2,7,blue);}
  else {rect(3,3,10,10,blue);rect(6,6,4,4,light);}
  ctx.restore();
}
