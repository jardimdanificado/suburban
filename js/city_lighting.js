import { ROAD_TILES, tileAt, terrainWalkable, canStep } from './city_terrain.js';
import { initializeInventory, inventoryFree } from './city_inventory.js';
export const LIGHTING_RULES = { roadSpacing: 7, privateSpacing: 3, stone: 2, labor: 20, installationFee: 8000, maxActiveSites: 4 };
export class CityLighting {
  constructor(city) { this.city = city; this.posts = []; this.propertyStores = new Map(); this.roadPosts = new Map(); this.sites = new Map(); }
  siteOccupancy(){
    const city=this.city,blocked=new Set(),plots=new Map(),mark=p=>blocked.add(`${Math.floor(p.x)},${Math.floor(p.y)}`);
    for(const p of city.development.plots){mark(p.door);for(let y=p.y;y<p.y+p.depth;y++)for(let x=p.x;x<p.x+p.width;x++)plots.set(`${x},${y}`,p.id);}
    for(const p of city.development.projects)if(!p.cancelled&&p.status!=='completed'){mark(p.door);for(const t of p.route||[])mark(t);}
    for(const b of city.buildings)if(!b.entity.destroyed){for(let y=b.entity.y;y<b.entity.y+b.depth;y++)for(let x=b.entity.x;x<b.entity.x+b.width;x++)blocked.add(`${x},${y}`);for(const p of b.accessPath||[])mark(p);}
    for(const c of city.citizens)if(!c.entity.destroyed)mark(c.entity);
    return {blocked,plots};
  }
  freeSite(x, y, building = null,occupancy=null) {
    const city = this.city;
    if (!terrainWalkable(city.world, x, y) || ROAD_TILES.has(tileAt(city.world, x, y)) || city.occupied.has(`${x},${y}`)) return false;
    if(occupancy){const key=`${x},${y}`;return !occupancy.blocked.has(key)&&(!occupancy.plots.has(key)||occupancy.plots.get(key)===building?.plotId);}
    if (city.development.plots.some(p => Math.floor(p.door.x) === x && Math.floor(p.door.y) === y)) return false;
    if (city.development.projects.some(p => !p.cancelled && p.status !== 'completed' && Math.floor(p.door.x) === x && Math.floor(p.door.y) === y)) return false;
    if (city.development.plots.some(p => p.id !== building?.plotId && x >= p.x && x < p.x + p.width && y >= p.y && y < p.y + p.depth)) return false;
    if (city.buildings.some(b => !b.entity.destroyed && (x >= b.entity.x && x < b.entity.x + b.width && y >= b.entity.y && y < b.entity.y + b.depth || b.accessPath?.some(p => Math.floor(p.x) === x && Math.floor(p.y) === y)))) return false;
    if (city.development.projects.some(p => !p.cancelled && p.status !== 'completed' && p.route?.some(t => Math.floor(t.x) === x && Math.floor(t.y) === y))) return false;
    return !city.citizens.some(c => !c.entity.destroyed && Math.floor(c.entity.x) === x && Math.floor(c.entity.y) === y);
  }
  findSite(point, building = null,occupancy=null) {
    const x = Math.floor(point.x), y = Math.floor(point.y);
    const radius = building ? 4 : 2;
    for (let r = 1; r <= radius; r++) for (const [dx, dy] of [[r,0],[-r,0],[0,r],[0,-r]]) {
      const xx = x + dx, yy = y + dy;
      if (!this.freeSite(xx, yy, building,occupancy)) continue;
      const street = [[xx + 1, yy], [xx - 1, yy], [xx, yy + 1], [xx, yy - 1]].find(([sx, sy]) => ROAD_TILES.has(tileAt(this.city.world, sx, sy)) && canStep(this.city.world, sx, sy, xx, yy));
      if (street) return { x: xx + .5, y: yy + .5, door: { x: street[0] + .5, y: street[1] + .5 } };
    }
    return null;
  }
  plan(post) {
    if (this.sites.has(post.id) && this.sites.get(post.id).status !== 'cancelled') return this.sites.get(post.id);
    const spacing = post.public ? LIGHTING_RULES.roadSpacing : LIGHTING_RULES.privateSpacing;
    if ([...this.sites.values()].some(p => p.status !== 'cancelled' && Math.hypot(p.x - post.x, p.y - post.y) < (post.public && p.public ? spacing : LIGHTING_RULES.privateSpacing))) return null;
    post.status = 'planned'; post.built = false;
    this.sites.set(post.id, post); return post;
  }
  reserve(post) {
    const city = this.city;
    if (post.projectId || post.built || post.status === 'cancelled') return;
    const pending = city.development.projects.filter(p => p.service === 'lamp' && !p.cancelled && p.status !== 'completed');
    if (pending.length >= LIGHTING_RULES.maxActiveSites || pending.filter(p=>this.sites.get(p.lampId)?.public===post.public).length>=(post.public?3:1) || !this.freeSite(Math.floor(post.x), Math.floor(post.y), city.building(post.buildingId))) return;
    const builder = city.development.selectBuilder(post.payerId, post.door);
    const fee = city.currency.price(LIGHTING_RULES.installationFee);
    const budget = Math.ceil(fee * (post.payerId === 'treasury' ? 1.5 : 1)) + LIGHTING_RULES.stone * city.economy.goods.pedra.price;
    if (!builder || (city.accounts.get(post.payerId)?.balance || 0) < budget) return;
    const project = city.development.registerService(post.payerId, builder, { service: 'lamp', type: 'lamp', name: post.public ? 'Instalação de poste público' : 'Instalação de iluminação do imóvel', lampId: post.id,priority:post.public?90:50, door: { ...post.door }, stone: LIGHTING_RULES.stone, requiredLabor: LIGHTING_RULES.labor, fee });
    if (!project) return;
    post.projectId = project.id; post.status = 'materials';
    city.occupied.add(`${Math.floor(post.x)},${Math.floor(post.y)}`);
    city.obstacleRevision=(city.obstacleRevision||0)+1;
  }
  completePost(project) {
    const post = this.sites.get(project.lampId);
    if (!post || post.status === 'cancelled' || !terrainWalkable(this.city.world, Math.floor(post.x), Math.floor(post.y)) || ROAD_TILES.has(tileAt(this.city.world, Math.floor(post.x), Math.floor(post.y)))) return null;
    post.status = 'completed'; post.built = true; post.builtAt = this.city.minute;
    if (!this.posts.includes(post)) this.posts.push(post);
    this.city.world.cityLampPosts = this.posts;
    return post;
  }
  cancelPost(post) {
    if (post.status === 'cancelled') return;
    const city = this.city, project = city.development.projects.find(p => p.id === post.projectId);
    if (project && project.status !== 'completed') {
      project.cancelled = true; project.active = false; project.status = 'cancelled';
      for (const s of city.logistics.shipments) if (s.buyer === project && !['delivered','cancelled'].includes(s.status)) city.logistics.cancel(s);
      city.transfer(project.feeAccountId, city.accounts.has(post.payerId) ? post.payerId : 'treasury', city.accounts.get(project.feeAccountId)?.balance || 0, 'Estorno de instalação de poste');
      const hall = city.buildings.find(b => b.type === 'townhall' && !b.entity.destroyed);
      for (const [good, quantity] of Object.entries(project.inventory)) {
        const stored = Math.min(quantity, hall ? inventoryFree(hall) : 0);
        if (hall) hall.inventory[good] += stored;
        city.economy.lost[good] += quantity - stored; project.inventory[good] = 0;
      }
    }
    if (post.projectId&&city.occupied.delete(`${Math.floor(post.x)},${Math.floor(post.y)}`))city.obstacleRevision=(city.obstacleRevision||0)+1;
    post.status = 'cancelled'; post.built = false; post.lit = false;
  }
  reconcile() {
    const projects = new Map(this.city.development.projects.map(p => [p.id, p]));
    for (const post of this.sites.values()) {
      if (post.status === 'cancelled') continue;
      const b = this.city.building(post.buildingId);
      const project = projects.get(post.projectId);
      if ((!post.projectId && this.city.occupied.has(`${Math.floor(post.x)},${Math.floor(post.y)}`)) || (!post.public && (!b || !b.units.some(u => u.ownerId === post.payerId))) || (project && !post.built && (project.cancelled || !project.builderId)) || !terrainWalkable(this.city.world, Math.floor(post.x), Math.floor(post.y)) || ROAD_TILES.has(tileAt(this.city.world, Math.floor(post.x), Math.floor(post.y)))) this.cancelPost(post);
    }
    this.posts = this.posts.filter(p => p.built && p.status !== 'cancelled');
    this.city.world.cityLampPosts = this.posts;
  }
  refillDepot(post,payer) {
    const id=`refill:${post.id}`;
    let depot=this.propertyStores.get(id);
    if(!depot){depot={id,name:'Abastecimento de lamparina',type:'lamp-refill',active:true,accountId:payer,door:{...post.door},lampPost:post};initializeInventory(depot,this.city.economy.goods,1);this.propertyStores.set(id,depot);}
    depot.active=post.built && post.status!=='cancelled';return depot;
  }
  hourly() {
    const city = this.city, buildings = city.buildings.filter(b => !b.entity.destroyed);
    const utility = buildings.find(b => b.type === 'utility') || buildings.find(b => b.type === 'townhall');
    if (!utility) return;
    this.reconcile();
    const night = city.hour < 6 || city.hour >= 18, groups = new Map(), posts = [],occupancy=this.siteOccupancy();
    const register = (holder, payer, post) => {
      if (!post.built) return;
      const key = `${holder.id}:${payer}`;
      if (!groups.has(key)) groups.set(key, { holder, payer, posts: [] });
      groups.get(key).posts.push(post); posts.push(post);
    };
    const seenRoadTiles=new Set();
    const planRoad=point=>{
      const key=`${Math.floor(point.x)},${Math.floor(point.y)}`;if(seenRoadTiles.has(key))return;seenRoadTiles.add(key);
      if(!ROAD_TILES.has(tileAt(city.world,Math.floor(point.x),Math.floor(point.y))))return;
      if([...this.roadPosts.values()].some(p=>p.status!=='cancelled'&&Math.hypot(p.door.x-point.x,p.door.y-point.y)<LIGHTING_RULES.roadSpacing))return;
      const site=this.findSite(point,null,occupancy);if(!site)return;
      const id=`road:${Math.floor(site.x)}:${Math.floor(site.y)}`,post=this.plan({id,...site,fuel:0,lit:false,public:true,payerId:'treasury'});
      if(post)this.roadPosts.set(id,post);
    };
    for(const [key] of [...city.traffic].sort((a,b)=>b[1]-a[1]).slice(0,128)){const [x,y]=key.split(',').map(Number);planRoad({x:x+.5,y:y+.5});}
    for (const b of [...buildings].sort((a,b)=>city.trafficScore(b.accessPath)-city.trafficScore(a.accessPath))) {
      // Road lamps belong to the city, independently of the neighbouring owner.
      for(const point of [...(b.accessPath||[])].sort((a,b)=>city.trafficScore([b])-city.trafficScore([a])))planRoad(point);
      const owners = new Map();
      for (const unit of b.units) if (unit.ownerId && !owners.has(unit.ownerId)) owners.set(unit.ownerId, unit);
      for (const owner of owners.keys()) {
        const id = `property:${b.id}:${owner}`;
        let holder = this.propertyStores.get(id);
        if (!holder || holder.post.status === 'cancelled') {
          const site = this.findSite(b.door, b,occupancy); if (!site) continue;
          const post = this.plan({ id, buildingId: b.id, ...site, fuel: 0, lit: false, public: false, payerId: owner });
          if (!post) continue;
          holder = { id, type: 'property-lighting', active: true, entity: b.entity, accountId: owner, ownerId: city.development.ownerCitizen(owner)?.id, door: b.door, post };
          const previous = this.propertyStores.get(id);
          initializeInventory(holder, city.economy.goods, 24);
          if (previous) holder.inventory = previous.inventory;
          this.propertyStores.set(id, holder);
        }
        holder.active = true; register(holder, owner, holder.post);
      }
    }
    for (const [id, post] of this.roadPosts) {
      if (!ROAD_TILES.has(tileAt(city.world, Math.floor(post.door.x), Math.floor(post.door.y)))) { this.cancelPost(post); this.roadPosts.delete(id); continue; }
      register(utility, 'treasury', post);
    }
    for (const [id, holder] of this.propertyStores) {
      if(holder.lampPost) {holder.active=holder.lampPost.built && holder.lampPost.status!=='cancelled';continue;}
      const b = city.building(holder.post.buildingId);
      if (b && b.units.some(u => u.ownerId === holder.post.payerId)) continue;
      for (const shipment of city.logistics.shipments) if (shipment.buyer === holder && !['cancelled', 'delivered'].includes(shipment.status)) city.logistics.cancel(shipment);
      // Retired property fuel remains in its depot for exact stock accounting.
      holder.active = false; this.cancelPost(holder.post);
    }
    const mills=city.economy.businesses.filter(b=>b.inventory.oleo>0);
    for (const { holder, payer, posts: lamps } of groups.values()) {
      for (const post of lamps) {
        // A carrier takes a real unit from the depot and fills the lamp on site.
        const pending=city.logistics.shipments.find(s=>s.buyer.lampPost===post&&!['delivered','cancelled'].includes(s.status));
        if(post.fuel<=6&&!pending){
          const depot=this.refillDepot(post,payer);let ordered=false;
          if(holder.inventory.oleo>0)ordered=city.logistics.order(holder,depot,'oleo',1,0,{payerAccountId:payer,purpose:'lamp-refill',requireCarrier:true});
          if(!ordered)for(const mill of mills.filter(m=>m!==holder).sort((a,b)=>Math.hypot(a.door.x-post.x,a.door.y-post.y)-Math.hypot(b.door.x-post.x,b.door.y-post.y)))if(city.logistics.order(mill,depot,'oleo',1,Math.ceil(city.economy.goods.oleo.price*(payer==='treasury'?1.5:1)),{payerAccountId:payer,purpose:'lamp-refill',requireCarrier:true})){ordered=true;break;}
          const carriers=city.economy.businesses.some(b=>b.type==='carrier'&&(b.workers.length||b.ownerId));
          post.supplyStatus=ordered?'Abastecimento contratado':!mills.length&&!holder.inventory.oleo?'Sem óleo disponível':!carriers?'Aguardando transportadora':'Aguardando caixa ou rota de entrega';
        }else post.supplyStatus=pending?'Óleo em transporte':post.fuel>0?'Abastecido':'Aguardando pedido';
        post.lit = night && post.fuel > 0;
        if (post.lit) post.fuel--;
      }
    }

    // Only contracted sites reserve land; at most four installations run concurrently.
    for (const post of [...this.sites.values()].sort((a,b)=>Number(b.public)-Number(a.public)||city.trafficScore([b.door])-city.trafficScore([a.door]))) this.reserve(post);
    this.posts = posts; city.world.cityLampPosts = posts;
    city.world.cityLampSites = [...this.sites.values()].filter(p => p.projectId && !p.built && p.status !== 'cancelled');
  }
}
