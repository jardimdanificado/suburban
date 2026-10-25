import {ROAD_TILES,tileAt} from './city_terrain.js';
const blocked=new Set(['vote','research','interview','council-session','care','caregiving','food','provisions','water','health','energy','toilet','workmeal','construction','work','manage']);
const live=c=>!!c?.entity&&!c.entity.destroyed;
export class CityCampaignMaterials {
  constructor(city){this.city=city;this.missions=[];this.decorations=[];this.nextId=1;this.lastDay=null;}
  demand(good){const e=this.city.politics.active;if(!e||e.status!=='campaign')return 0;return ({panfletos:12,bandeiras:3,faixas:2,tinta:6})[good]*e.candidates.length||0;}
  fund(n,e){
    const city=this.city,c=city.society.citizen(n.citizenId),party=city.politics.party(n.partyId);if(!live(c))return;
    n.campaignFinance??={received:0,spent:0,donors:[]};
    for(const donor of city.politics.campaigns.sample(party.memberIds.map(id=>city.society.citizen(id)).filter(a=>live(a)&&a.id!==c.id&&a.balance>city.currency.price(8000)),3)){
      const amount=Math.min(city.currency.price(3000),Math.floor((donor.balance-city.currency.price(5000))*.08));if(amount<=0)continue;
      if(city.transfer(donor.accountId,city.politics.partyAccount(party).accountId,amount,'Doação privada de campanha',{electionId:e.id,candidateId:c.id,partyId:party.id})){n.campaignFinance.received+=amount;n.campaignFinance.donors.push({citizenId:donor.id,amount,minute:city.minute});}
    }
  }
  roadside(){
    const city=this.city;
    for(const [key]of [...city.traffic].sort((a,b)=>b[1]-a[1]).slice(0,24)){
      const [x,y]=key.split(',').map(Number);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
        const px=x+dx,py=y+dy;if(!city.walkable(px,py)||ROAD_TILES.has(tileAt(city.world,px,py))||city.occupied.has(`${px},${py}`)||city.development.plots.some(p=>px>=p.x&&py>=p.y&&px<p.x+p.width&&py<p.y+p.depth)||this.decorations.some(d=>!d.entity.destroyed&&Math.hypot(d.entity.x-px-.5,d.entity.y-py-.5)<4)||this.missions.some(m=>m.kind==='flag'&&['assigned','active'].includes(m.status)&&Math.hypot(m.destination.x-px-.5,m.destination.y-py-.5)<2))continue;
        return {x:px+.5,y:py+.5};
      }
    }
    return null;
  }
  property(n){
    const city=this.city,party=city.politics.party(n.partyId),candidate=city.society.citizen(n.citizenId);
    const options=city.buildings.filter(b=>b.active&&!b.entity.destroyed&&!b.municipal&&!['townhall','council_chamber','mint'].includes(b.type)&&!b.campaignPaint&& !this.decorations.some(d=>d.buildingId===b.id&&!d.entity.destroyed));
    for(const b of city.politics.campaigns.sample(options,8)){
      const account=b.units[0]?.ownerId,owner=city.accounts.get(account);if(!live(owner)||!owner?.entity?.properties.citizen||!b.units.every(u=>u.ownerId===account))continue;
      city.politics.initializeCitizen(owner);const affinity=1-city.politics.distance(owner.political.ideology,party.ideology)/2.8,trust=(city.relationships.view(owner,candidate)?.trust??50)/100;
      if(city.random()>.1+Math.max(0,affinity)*.4+trust*.15)continue;
      return {x:b.door.x,y:b.door.y,buildingId:b.id,ownerId:owner.id,ownerAccountId:account,permissionFee:city.currency.price(300+b.width*b.depth*30)};
    }
    return null;
  }
  plan(e){
    const city=this.city;if(city.hour<8||city.hour>=20)return;
    for(const n of e.candidates){const candidate=city.society.citizen(n.citizenId),party=city.politics.party(n.partyId);if(!live(candidate)||!party?.active)continue;if(n.campaignFinanceDay!==city.day){this.fund(n,e);n.campaignFinanceDay=city.day;}
      const pool=city.citizens.filter(c=>live(c)&&city.society.isAdult(c)&&c.id!==candidate.id&&!c.campaign&&!c.researchAssignment&&!c.deliveryId&&!c.cleaningJobId&&!c.workMeal&&!c.conversation&&!blocked.has(c.task)&&!city.urgentNeed(c));
      for(const kind of ['pamphlet','flag','banner','paint']){
        if(this.missions.some(m=>m.electionId===e.id&&m.candidateId===n.citizenId&&m.kind===kind&&m.requestDay===city.day))continue;
        const neededGood={pamphlet:'panfletos',flag:'bandeiras',banner:'faixas',paint:'tinta'}[kind];if(!city.economy.businesses.some(b=>(b.inventory[neededGood]||0)>0))continue;
        const worker=city.politics.campaigns.sample(pool.filter(c=>!c.campaign),8).sort((a,b)=>(b.skills.social||0)-(a.skills.social||0))[0];if(!worker)break;
        let destination=kind==='flag'?this.roadside():['paint','banner'].includes(kind)?this.property(n):city.politics.getResearch().sites()[0];if(!destination)continue;
        const good={pamphlet:'panfletos',flag:'bandeiras',banner:'faixas',paint:'tinta'}[kind],quantity=kind==='pamphlet'?3:kind==='paint'?Math.max(1,Math.ceil(city.building(destination.buildingId).width*city.building(destination.buildingId).depth/6)):1;
        const shop=city.economy.businesses.filter(b=>b.active&&!b.entity.destroyed&&(b.inventory[good]||0)>=quantity).sort((a,b)=>Math.hypot(a.door.x-worker.entity.x,a.door.y-worker.entity.y)-Math.hypot(b.door.x-worker.entity.x,b.door.y-worker.entity.y))[0];if(!shop)continue;
        const unitPrice=city.economy.goods[good].price,fee=city.currency.price(600),cost=unitPrice*quantity+fee+(destination.permissionFee||0);if(city.politics.partyAccount(party).balance<cost)continue;
        const path=city.findPath(worker.entity,shop.door);if(path===null)continue;
        const mission={id:this.nextId++,electionId:e.id,requestDay:city.day,candidateId:n.citizenId,candidateName:n.name,partyId:n.partyId,partyNumber:party.number,workerId:worker.id,shopId:shop.id,kind,good,quantity,unitPrice,fee,destination,status:'assigned',stage:'pickup',startedAt:city.minute,until:Math.min(e.voteAt,city.minute+240),paid:0,docIds:[]};
        this.missions.push(mission);worker.campaign={type:'paid',missionId:mission.id,electionId:e.id,candidateId:n.citizenId,partyId:n.partyId,flag:null,until:mission.until,destination};worker.path=path;worker.task='campaign';worker.targetId=shop.id;worker.action='Indo retirar material de campanha';
        mission.eventId=city.politics.campaigns.event(e,`${n.name} (${party.number}) contratou ${worker.entity.properties.name}: ${kind==='pamphlet'?'panfletaço':kind==='flag'?'bandeira à beira da estrada':kind==='banner'?'faixa em imóvel autorizado':'pintura de fachada autorizada'}.`,'campaign-contract',[n.citizenId,worker.id],{missionId:mission.id,partyId:party.id,partyNumber:party.number,good,quantity,shopId:shop.id,buildingId:destination.buildingId}).id;
      }
    }
    while(this.missions.length>128){const i=this.missions.findIndex(m=>!['assigned','active'].includes(m.status));if(i<0)break;this.missions.splice(i,1);}
  }
  release(c,reason){const mission=this.missions.find(m=>m.id===c.campaign?.missionId);if(mission&&['assigned','active'].includes(mission.status)){mission.status='interrupted';mission.reason=reason;}c.campaign=null;if(c.task==='campaign'){c.task=null;c.path=[];c.targetId=null;}}
  work(c){
    const city=this.city,e=city.politics.active,m=this.missions.find(m=>m.id===c.campaign?.missionId),n=e?.candidates.find(n=>n.citizenId===m?.candidateId),candidate=city.society.citizen(m?.candidateId);
    if(!m||!n||!live(candidate)||e.id!==m.electionId||e.status!=='campaign'||city.minute>=m.until||city.urgentNeed(c)||Math.min(c.needs.food,c.needs.water,c.needs.energy,c.needs.toilet)<25){this.release(c,'Campanha encerrada ou trabalhador indisponível');return;}
    const party=city.politics.party(m.partyId);if(!party?.active){this.release(c,'Partido indisponível');return;}
    c.campaignInventory??={};
    if(m.stage==='pickup'){
      const shop=city.building(m.shopId),cost=m.quantity*m.unitPrice;
      if(!shop?.active||shop.entity.destroyed||Math.hypot(c.entity.x-shop.door.x,c.entity.y-shop.door.y)>1.5||shop.inventory[m.good]<m.quantity||city.politics.partyAccount(party).balance<cost+m.fee+(m.destination.permissionFee||0)){this.release(c,'Fornecedor, material ou pagamento indisponível');return;}
      const route=city.findPath(c.entity,m.destination);if(route===null){this.release(c,'Sem rota para instalação ou propaganda');return;}
      if(!city.transfer(city.politics.partyAccount(party).accountId,shop.accountId,cost,'Serviço: Material de campanha',{electionId:e.id,missionId:m.id,good:m.good,quantity:m.quantity,buildingId:shop.id}))return;
      shop.inventory[m.good]-=m.quantity;city.economy.recordGoods('campaign-pickup',m.good,m.quantity,shop.id,null);m.paid+=cost;n.campaignFinance.spent+=cost;
      if(m.kind==='pamphlet')for(let i=0;i<m.quantity;i++){
        const doc=city.publications.takeStock(shop,c,'panfletos'),event=city.history.record('government',`${n.name}, número ${party.number}, ${party.name}: ${n.promises.map(pr=>pr.title).join('; ')}.`,[candidate.accountId],{kind:'campaign-leaflet',electionId:e.id,candidateId:n.citizenId,partyId:party.id,partyNumber:party.number,missionId:m.id});
        city.publications.write(doc.id,c.id,{eventId:event.id,type:'propaganda'});m.docIds.push(doc.id);
      }
      else c.campaignInventory[m.good]=(c.campaignInventory[m.good]||0)+m.quantity;
      if(!city.transfer(city.politics.partyAccount(party).accountId,c.accountId,m.fee,'Serviço: Propaganda eleitoral contratada',{electionId:e.id,missionId:m.id,workerId:c.id}))return;
      m.paid+=m.fee;n.campaignFinance.spent+=m.fee;m.stage='outreach';m.status='active';c.path=route;c.targetId=m.destination.buildingId??null;c.action='Levando material para campanha';return;
    }
    if(Math.hypot(c.entity.x-m.destination.x,c.entity.y-m.destination.y)>1.5){this.release(c,'Deslocamento interrompido');return;}
    if(m.kind==='pamphlet'){
      c.action=`Panfletaço pago por ${n.name} · ${party.number}`;if(city.minute-(m.lastContactAt??-Infinity)<10)return;m.lastContactAt=city.minute;
      const listeners=city.citizens.filter(v=>live(v)&&v.id!==c.id&&city.society.isAdult(v)&&!m.recipientIds?.includes(v.id)&&Math.hypot(v.entity.x-c.entity.x,v.entity.y-c.entity.y)<=3);
      const voter=listeners[Math.floor(city.random()*listeners.length)];if(voter){
        city.politics.initializeCitizen(voter);m.recipientIds??=[];m.recipientIds.push(voter.id);
        const doc=city.publications.documents.get(m.docIds.find(id=>city.publications.documents.get(id)?.ownerAccountId===c.accountId));
        if(doc){city.publications.move(doc,voter.accountId);city.publications.read(doc.id,voter.id);}
        const relation=city.relationships.view(voter,c),affinity=1-city.politics.distance(voter.political.ideology,party.ideology)/2.8,quality=Math.max(.02,Math.min(.9,.15+(c.skills.social||0)/200+affinity*.2+((relation?.trust??50)-50)/250-(voter.political.criticalSense??.5)*.15));
        if(city.random()<quality){city.politics.campaigns.hearPromises(voter,n,e,'Conversa com propagandista contratado');city.politics.remember(voter,{kind:'paid-canvassing',electionId:e.id,candidateId:n.citizenId,partyId:party.id,effect:quality*4,promiseKey:`canvassing:${e.id}:${n.citizenId}:${voter.id}`,description:`Conversou com ${c.entity.properties.name} sobre ${n.name}, número ${party.number}.`});}
      }
      if((m.recipientIds?.length||0)>=6){m.status='completed';c.campaign=null;c.task=null;}return;
    }
    m.installationLabor=(m.installationLabor||0)+1;c.action=m.kind==='paint'?'Pintando fachada contratada':'Instalando propaganda contratada';if(m.installationLabor<(m.kind==='paint'?30:12))return;
    const building=city.building(m.destination.buildingId);
    if(building&&(!building.active||building.entity.destroyed||!building.units.every(u=>u.ownerId===m.destination.ownerAccountId))){this.release(c,'A autorização do imóvel deixou de ser válida');return;}
    if(m.destination.permissionFee){if(!city.transfer(city.politics.partyAccount(party).accountId,m.destination.ownerAccountId,m.destination.permissionFee,'Serviço: Autorização de publicidade em fachada',{electionId:e.id,missionId:m.id,buildingId:building.id})){this.release(c,'Sem recursos para a autorização');return;}m.paid+=m.destination.permissionFee;n.campaignFinance.spent+=m.destination.permissionFee;}
    if((c.campaignInventory[m.good]||0)<m.quantity){this.release(c,'Material não está com o instalador');return;}c.campaignInventory[m.good]-=m.quantity;this.consumeMaterial(m);
    const d={id:m.id,kind:m.kind,rotation:building?.rotation??0,buildingId:building?.id??null,partyId:party.id,partyNumber:party.number,candidateId:n.citizenId,candidateName:n.name,partyName:party.name,flag:party.flag,color:party.flag.background,until:e.voteAt+1440,installedAt:city.minute,missionId:m.id};
    d.entity=city.createEntity({x:m.destination.x,y:m.destination.y,properties:{name:`${n.name} · ${party.number}`,campaignDecoration:d,render:{size:1,color:parseInt(d.color.slice(1),16)}}});this.decorations.push(d);if(m.kind==='paint'){building.campaignPaint=d;building.geometryRevision=(building.geometryRevision||0)+1;}
    city.politics.campaigns.event(e,`${c.entity.properties.name} concluiu propaganda de ${n.name}, número ${party.number}.`,'campaign-installation',[n.citizenId,c.id],{missionId:m.id,buildingId:building?.id,x:d.entity.x,y:d.entity.y,good:m.good,quantity:m.quantity});m.status='completed';c.campaign=null;c.task=null;c.action='Serviço de campanha concluído';
  }
  consumeMaterial(m){
    if(m.materialConsumed||m.kind==='pamphlet')return;
    const city=this.city;city.economy.consumed[m.good]+=m.quantity;m.materialConsumed=true;
    city.economy.recordGoods('campaign-installation',m.good,m.quantity,null,m.destination.buildingId,{missionId:m.id,electionId:m.electionId});
  }
  minute(){
    const city=this.city;
    for(const m of this.missions)if(m.status==='completed')this.consumeMaterial(m);
    for(const d of this.decorations)if(!d.entity.destroyed&&city.minute>=d.until){d.entity.destroyed=true;const b=city.building(d.buildingId);if(b?.campaignPaint===d){b.campaignPaint=null;b.geometryRevision=(b.geometryRevision||0)+1;}}
    this.decorations=this.decorations.filter(d=>!d.entity.destroyed);
    for(const c of city.citizens)if(c.campaign?.type==='paid'&&(!city.politics.active||city.minute>=c.campaign.until||c.task!=='campaign'))this.release(c,'Contrato interrompido ou encerrado');
    // Visibility of a real installation affects only nearby passers-by, once per day.
    if(city.minute%30===0){const e=city.politics.active;if(e?.status!=='campaign')return;for(const d of this.decorations){const n=e.candidates.find(n=>n.citizenId===d.candidateId);if(!n)continue;for(const c of city.citizens.filter(c=>live(c)&&city.society.isAdult(c)&&Math.hypot(c.entity.x-d.entity.x,c.entity.y-d.entity.y)<5).slice(0,12)){
      city.politics.initializeCitizen(c);if(c.political.memories.some(m=>m.promiseKey===`sign:${e.id}:${d.id}:${city.day}`))continue;city.politics.campaigns.hearPromises(c,n,e,'Publicidade vista na rua');city.politics.remember(c,{kind:'campaign-sign',electionId:e.id,candidateId:n.citizenId,partyId:n.partyId,effect:.5,promiseKey:`sign:${e.id}:${d.id}:${city.day}`,description:`Viu propaganda de ${n.name}, número ${d.partyNumber}.`});
    }}}
  }
}
