/** The legislature needs real premises, offices and in-person plenary sessions. */
export class CityCouncilChamber {
  constructor(city){this.city=city;this.buildingIds=[];this.contracts=[];this.lastPlanDay=null;this.lastMinute=null;this.sessions=[];}
  buildings(){return this.city.buildings.filter(b=>b.type==='council_chamber'&&b.active&&!b.entity.destroyed);}
  hall(){return this.buildings()[0]||null;}
  open(){return this.city.hour>=10&&this.city.hour<12||this.city.hour>=15&&this.city.hour<17;}
  present(){const hall=this.hall();return hall?this.city.politics.council.people().filter(c=>c.task==='council-session'&&c.councilSession?.buildingId===hall.id&&!c.path.length&&Math.hypot(c.entity.x-hall.door.x,c.entity.y-hall.door.y)<1.5&&!this.city.urgentNeed(c)):[];}
  quorum(){const council=this.city.politics.council;return this.present().reduce((n,c)=>n+council.weight(c.id),0)>council.totalWeight()/2;}
  plan(){
    const city=this.city,council=city.politics.council,buildings=this.buildings();
    for(const b of buildings){b.municipal=true;for(const u of b.units){u.forSale=u.forRent=false;if(u.z===0)u.roomType='plenary';else if(!['bathroom','dining'].includes(u.roomType))u.roomType='office';}}
    const offices=buildings.flatMap(b=>b.units.filter(u=>u.z>0&&u.roomType==='office'));
    for(const u of offices)u.councilorId=null;for(const [i,member]of council.members.entries()){const office=offices[i];member.officeUnitId=office?.id??null;if(office)office.councilorId=member.citizenId;}
    this.officeCount=offices.length;this.requiredOffices=council.members.length;
    if(this.lastPlanDay===city.day)return;this.lastPlanDay=city.day;
    const pending=city.development.projects.filter(p=>p.type==='council_chamber'&&!p.cancelled&&p.status!=='completed');if(pending.length)return;
    const reserve=city.welfare.conditions().reserve;
    if(city.treasury<reserve+city.currency.price(100000))return;
    let project;
    if(!buildings.length||offices.length<council.members.length){
      const expandable=buildings.find(b=>b.floors<12);
      if(expandable&&city.treasury>=reserve+expandable.width*expandable.depth*(2*city.economy.goods.pedra.price+city.currency.price(18000)))project=city.development.beginExpansion('treasury',expandable.id,{floors:1});
      else if(!expandable&&city.treasury>=reserve+32*(2*city.economy.goods.pedra.price+city.currency.price(18000))+city.currency.price(20000)){
        city.development.ensurePlots();const lot=city.development.plots.find(p=>p.ownerId==='treasury'&&!p.buildingId&&!p.projectId&&!['farm','quarry'].includes(p.type)&&p.width>=4&&p.depth>=4);
        if(lot)project=city.development.beginProject('treasury',lot.id,'council_chamber',{width:4,depth:4,floors:2,priority:75});
      }
    }
    if(project){project.costCenter='council';this.contracts.push(project.id);city.log(`Câmara contratou ${project.service==='expansion'?'ampliação para novos gabinetes':'sede com plenário térreo e gabinetes'}; ${offices.length}/${council.members.length} gabinetes disponíveis.`,'government',[],{kind:'council-premises-contracted',projectId:project.id,buildingId:project.buildingId,costCenter:'council',fee:project.fee});}
  }
  arrive(c){const hall=this.hall();if(!hall||!this.open()||Math.hypot(c.entity.x-hall.door.x,c.entity.y-hall.door.y)>1.5){this.release(c);return;}c.action='No plenário da Câmara: sessão legislativa';}
  release(c){if(c.task==='council-session'){c.task=null;c.path=[];}c.councilSession=null;}
  minute(){
    const city=this.city,council=city.politics.council;if(this.lastMinute===city.minute)return;this.lastMinute=city.minute;const members=new Set(council.members.map(m=>m.citizenId));for(const bill of council.bills)if(bill.status==='awaiting-session'&&!members.has(bill.authorId)){bill.status='dismissed';bill.result='Autor deixou a Câmara antes de apresentar o projeto';city.log(`Projeto arquivado antes da apresentação: ${bill.title}.`,'government',[bill.authorId],{kind:'bill-dismissed',billId:bill.id});}const hall=this.hall();
    if(!hall||!this.open()){for(const c of council.people())if(c.councilSession)this.release(c);return;}
    let routed=0;
    for(const c of council.people()){
      if(c.councilSession&&c.task!=='council-session')c.councilSession=null;
      if(c.task==='council-session'){if(city.urgentNeed(c))this.release(c);continue;}
      if(routed>=2||c.deliveryId||c.cleaningJobId||c.workMeal||c.conversation||['vote','research','interview','campaign','care','caregiving','food','provisions','water','health','energy','toilet','workmeal'].includes(c.task)||city.urgentNeed(c)||Math.min(c.needs.food,c.needs.water,c.needs.energy,c.needs.toilet)<35||city.minute-(c.lastCouncilRouteAt??-Infinity)<30)continue;
      c.lastCouncilRouteAt=city.minute;const path=city.findPath(c.entity,hall.door);if(path===null)continue;
      c.path=path;c.task='council-session';c.targetId=hall.id;c.councilSession={buildingId:hall.id,startedAt:city.minute};c.action='Indo à sessão da Câmara';routed++;
    }
    const present=this.present(),presentIds=new Set(present.map(c=>c.id));
    for(const bill of council.bills.filter(b=>b.status==='awaiting-session'&&presentIds.has(b.authorId))){bill.status='proposed';bill.proposedAt=city.minute;bill.voteAt=city.minute+60;bill.plenaryBuildingId=hall.id;bill.proposalEventId=city.log(`${bill.authorName} apresentou no plenário: ${bill.title}.`,'government',[bill.authorId],{kind:'bill-proposed',billId:bill.id,buildingId:hall.id,parentEventId:bill.eventId}).id;}
    if(this.quorum())for(const bill of council.bills.filter(b=>b.status==='proposed'&&city.minute>=b.voteAt))council.vote(bill);
  }
}
