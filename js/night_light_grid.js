// Conservative X/Z bins: a light is listed in every cell touched by its radius.
// Height and the exact spherical cutoff are evaluated in the lighting shader.
export const NIGHT_LIGHT_CAPACITY = 256;
export const NIGHT_GRID_SIDE = 128;
export const NIGHT_INDEX_WIDTH = 1024;
export class NightLightGrid {
  constructor() {
    this.lights = new Float32Array(NIGHT_LIGHT_CAPACITY * 8);
    this.previous = new Float64Array(NIGHT_LIGHT_CAPACITY * 8);
    this.cells = new Float32Array(NIGHT_GRID_SIDE * NIGHT_GRID_SIDE * 4);
    this.counts = new Uint16Array(NIGHT_GRID_SIDE * NIGHT_GRID_SIDE);
    this.cursors = new Uint32Array(this.counts.length);
    this.bounds = new Int32Array(NIGHT_LIGHT_CAPACITY * 4);
    this.indices = new Float32Array(NIGHT_INDEX_WIDTH * 4);
    this.count = 0;
    this.width = this.height = 1;
    this.cellSize = 8;
    this.originX = this.originZ = 0;
    this.references = this.maxCellLights = 0;
  }
  update(sources) {
    const previousCount=this.count;let changed=false;
    this.count = 0;
    let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;
    for (const light of sources) {
      if (!light.visible || !(light.intensity > 0) || !(light.distance > 0)) continue;
      if (this.count === NIGHT_LIGHT_CAPACITY) break;
      const i=this.count++,at=i*4,colorAt=(NIGHT_LIGHT_CAPACITY+i)*4,r=light.distance,p=light.position;
      const values=[p.x,p.y,p.z,r,light.color.r*light.intensity,light.color.g*light.intensity,light.color.b*light.intensity,light.decay];
      for(let j=0;j<8;j++){
        const index=j<4?at+j:colorAt+j-4,value=values[j];
        if(this.previous[index]!==value){changed=true;this.previous[index]=value;}
        this.lights[index]=value;
      }
      minX=Math.min(minX,p.x-r);minZ=Math.min(minZ,p.z-r);
      maxX=Math.max(maxX,p.x+r);maxZ=Math.max(maxZ,p.z+r);
    }
    if(!changed&&this.count===previousCount)return false;
    this.references=this.maxCellLights=0;
    if (!this.count) return true;
    this.cellSize=Math.max(8,Math.ceil(Math.max(maxX-minX,maxZ-minZ)/(NIGHT_GRID_SIDE-1)));
    this.originX=Math.floor(minX/this.cellSize)*this.cellSize;
    this.originZ=Math.floor(minZ/this.cellSize)*this.cellSize;
    this.width=Math.min(NIGHT_GRID_SIDE,Math.floor((maxX-this.originX)/this.cellSize)+1);
    this.height=Math.min(NIGHT_GRID_SIDE,Math.floor((maxZ-this.originZ)/this.cellSize)+1);
    this.counts.fill(0);
    for (let i=0;i<this.count;i++) {
      const at=i*4,x=this.lights[at],z=this.lights[at+2],r=this.lights[at+3];
      const x0=Math.max(0,Math.floor((x-r-this.originX)/this.cellSize)),x1=Math.min(this.width-1,Math.floor((x+r-this.originX)/this.cellSize));
      const z0=Math.max(0,Math.floor((z-r-this.originZ)/this.cellSize)),z1=Math.min(this.height-1,Math.floor((z+r-this.originZ)/this.cellSize));
      this.bounds.set([x0,x1,z0,z1],at);
      for(let zz=z0;zz<=z1;zz++)for(let xx=x0;xx<=x1;xx++)this.counts[zz*NIGHT_GRID_SIDE+xx]++;
    }
    for(let z=0;z<this.height;z++)for(let x=0;x<this.width;x++) {
      const cell=z*NIGHT_GRID_SIDE+x,n=this.counts[cell];
      this.cells[cell*4]=this.references;this.cells[cell*4+1]=n;
      this.cursors[cell]=this.references;this.references+=n;
      this.maxCellLights=Math.max(this.maxCellLights,n);
    }
    const length=Math.max(NIGHT_INDEX_WIDTH,Math.ceil(this.references/NIGHT_INDEX_WIDTH)*NIGHT_INDEX_WIDTH)*4;
    if(this.indices.length<length)this.indices=new Float32Array(length);
    for(let i=0;i<this.count;i++) {
      const at=i*4,x0=this.bounds[at],x1=this.bounds[at+1],z0=this.bounds[at+2],z1=this.bounds[at+3];
      for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)this.indices[this.cursors[z*NIGHT_GRID_SIDE+x]++*4]=i;
    }
    return true;
  }
}
