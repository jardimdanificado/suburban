import {DEVELOPMENT_RULES} from './city_development.js';
import {chooseBuildingSite} from './city_terrain.js';

/** The legislature needs real premises, offices and in-person plenary sessions. */
export class CityCouncilChamber {
  constructor(city){this.city=city;this.buildingIds=[];this.contracts=[];this.lastPlanHour=null;this.lastMinute=null;this.sessions=[];}
  buildings(){return this.city.buildings.filter(b=>b.type==='council_chamber'&&b.active&&!b.entity.destroyed);}
  hall(){return this.buildings()[0]||null;}
  workHours(){return this.city.hour>=8&&this.city.hour<17;}
  open(){return this.city.hour>=10&&this.city.hour<12||this.city.hour>=15&&this.city.hour<17;}
  present(){const hall=this.hall();return hall&&this.open()?this.city.politics.council.people().filter(c=>c.task==='council-session'&&c.councilSession?.buildingId===hall.id&&!c.path.length&&Math.hypot(c.entity.x-hall.door.x,c.entity.y-hall.door.y)<1.5&&!this.city.urgentNeed(c)):[];}
  quorum(){const council=this.city.politics.council;return this.present().reduce((n,c)=>n+council.weight(c.id),0)>council.totalWeight()/2;}
  report(reason,details={}){this.planning={minute:this.city.minute,reason,...details};}
  constructionCost(cells){const city=this.city;return cells*DEVELOPMENT_RULES.stonePerCell*city.economy.goods.pedra.price+Math.ceil(cells*city.currency.price(DEVELOPMENT_RULES.constructionFeePerCell)*DEVELOPMENT_RULES.municipalMultiplier);}
  plan(){
    const city=this.city,council=city.politics.council,buildings=this.buildings();
    for(const b of buildings){b.municipal=true;for(const u of b.units){u.forSale=u.forRent=false;if(u.z===0)u.roomType='plenary';else if(!['bathroom','dining'].includes(u.roomType))u.roomType='office';}}
    city.politics.syncGoverningFlag();
    const offices=buildings.flatMap(b=>b.units.filter(u=>u.z>0&&u.roomType==='office'));
    for(const u of offices)u.councilorId=null;for(const [i,member]of council.members.entries()){const office=offices[i];member.officeUnitId=office?.id??null;if(office)office.councilorId=member.citizenId;}
    this.officeCount=offices.length;this.requiredOffices=council.members.length;
    // Retry hourly: income and contractors can become available during the same day.
    const hour=Math.floor(city.minute/60);if(this.lastPlanHour===hour)return;this.lastPlanHour=hour;
    const pending=city.development.projects.find(p=>p.type==='council_chamber'&&!p.cancelled&&p.status!=='completed');
    if(pending){
      pending.costCenter='council';
      // The first plenary must not be indefinitely frozen by the homelessness it needs to legislate on.
      pending.priority=Math.max(pending.priority||0,buildings.length?90:92);pending.waitingForBasicNeeds=false;
      if(!this.contracts.includes(pending.id))this.contracts.push(pending.id);
      const builder=city.building(pending.builderId);
      const next=builder?.active&&!builder.entity.destroyed?builder:city.development.selectBuilder('treasury',pending.door);
      pending.waitingForCouncilContract=true;
      if(!next){this.report('Aguardando construtora com acesso ao canteiro.',{projectId:pending.id});return;}
      const cells=pending.service==='expansion'?city.building(pending.buildingId)?.width*city.building(pending.buildingId)?.depth*pending.floors:pending.width*pending.depth*pending.floors;
      const fee=Math.ceil(cells*city.currency.price(DEVELOPMENT_RULES.constructionFeePerCell)*DEVELOPMENT_RULES.municipalMultiplier),account=city.accounts.get(pending.feeAccountId);
      // Repair old self-build contracts without giving a newly assigned contractor free labor.
      if(!(pending.fee>0)){
        if(!account||city.treasury<city.welfare.conditions().reserve+fee){this.report('Aguardando caixa para contratar a construtora.',{projectId:pending.id,requiredBudget:fee});return;}
        if(!city.transfer('treasury',pending.feeAccountId,fee,'Reserva do contrato da Câmara',{projectId:pending.id}))return;
        pending.fee=fee;
      }
      pending.builderId=next.id;pending.waitingForCouncilContract=false;
      const supplied=(pending.inventory.pedra||0)+(pending.incoming.pedra||0);
      this.report(pending.status==='blocked'?`Obra bloqueada: ${pending.error||'aguardando liberação do local'}`:supplied<pending.stone?'Aguardando compra e entrega de pedras.':pending.inventory.pedra<pending.stone?'Materiais em transporte para o canteiro.':'Materiais disponíveis; aguardando trabalho da construtora.',{projectId:pending.id});return;
    }
    if(buildings.length&&offices.length>=council.members.length){this.report('Sede e gabinetes disponíveis.');return;}
    const reserve=city.welfare.conditions().reserve,available=Math.max(0,city.treasury-reserve);
    if(!city.development.clientCitizen('treasury')){this.report('Aguardando responsável pelo poder executivo.');return;}
    const expandable=buildings.find(b=>b.floors<12);
    let project;
    if(expandable){
      const cost=this.constructionCost(expandable.width*expandable.depth)+city.currency.price(20000);
      if(available<cost){this.report('Plenário funcionando; aguardando caixa para ampliar os gabinetes.',{requiredBudget:cost,availableBudget:available});return;}
      const builder=city.development.selectBuilder('treasury',expandable.door);
      if(!builder){this.report('Aguardando construtora para ampliar os gabinetes.');return;}
      project=city.development.beginExpansion('treasury',expandable.id,{floors:1,builderId:builder.id});
    }else{
      // Start with a single real ground-floor plenary. Upper-floor offices are separate contracts.
      const margin=city.currency.price(70000),minimum=this.constructionCost(4)+margin;
      if(available<minimum){this.report('Aguardando caixa para construir o plenário, preservando a reserva social.',{requiredBudget:minimum,availableBudget:available});return;}
      const urban=city.development.plots.filter(p=>p.ownerId==='treasury'&&!p.buildingId&&!p.projectId&&p.type!=='farm'&&p.width<=8&&p.depth<=8);
      city.development.ensurePlots(urban.some(p=>p.type!=='quarry'&&p.width>=2&&p.depth>=2)?18:Math.max(18,urban.length+1));
      const candidates=city.development.plots.filter(p=>p.ownerId==='treasury'&&!p.buildingId&&!p.projectId&&!['farm','quarry'].includes(p.type)&&p.width>=2&&p.depth>=2).sort((a,b)=>a.id-b.id);
      const offset=(this.plotCursor||0)%Math.max(1,candidates.length),lots=candidates.slice(offset).concat(candidates.slice(0,offset)).slice(0,8);this.plotCursor=offset+lots.length;
      if(!lots.length){this.report('Aguardando terreno público urbano com pelo menos 2×2 células.');return;}
      const target=Math.min(16,Math.max(4,Math.ceil(council.members.length/2)));
      const sizes=[[4,4],[4,3],[3,3],[3,2],[2,3],[2,2]].filter(([w,d])=>w*d<=Math.max(9,target));
      let siteFound=false,builderFound=false;
      for(const [width,depth]of sizes){
        if(this.constructionCost(width*depth)+margin>available)continue;
        for(const lot of lots){
          if(lot.width<width||lot.depth<depth)continue;
          const site=chooseBuildingSite(city,lot.x,lot.y,width,depth,{plotId:lot.id,type:'council_chamber'});if(site.error)continue;siteFound=true;
          const builder=city.development.selectBuilder('treasury',site.door);if(!builder)continue;builderFound=true;
          project=city.development.beginProject('treasury',lot.id,'council_chamber',{width,depth,floors:1,rotation:site.rotation,builderId:builder.id,priority:buildings.length?90:92});
          if(project)break;
        }
        if(project)break;
      }
      if(!project){this.report(!siteFound?'Aguardando terreno acessível com espaço para o plenário.':!builderFound?'Aguardando construtora com acesso ao terreno.':'Aguardando condições para contratar a sede.');return;}
    }
    if(project){project.costCenter='council';project.priority=buildings.length?90:92;project.waitingForCouncilContract=false;this.contracts.push(project.id);this.report('Obra contratada: aguardando entrega dos materiais.',{projectId:project.id});city.log(`Câmara contratou ${project.service==='expansion'?'ampliação para novos gabinetes':'plenário térreo; gabinetes serão construídos em ampliações'}; ${offices.length}/${council.members.length} gabinetes disponíveis.`,'government',[],{kind:'council-premises-contracted',projectId:project.id,buildingId:project.buildingId,costCenter:'council',fee:project.fee});}
    else this.report('Aguardando condições para contratar a ampliação.');
  }
  arrive(c){const hall=this.hall();if(!hall||!this.workHours()||Math.hypot(c.entity.x-hall.door.x,c.entity.y-hall.door.y)>1.5){this.release(c);return;}c.action=this.open()?'No plenário da Câmara: sessão legislativa':'No gabinete da Câmara: analisando projetos e atendendo eleitores';}
  release(c){if(c.task==='council-session'){c.task=null;c.path=[];}c.councilSession=null;}
  minute(){
    const city=this.city,council=city.politics.council;if(this.lastMinute===city.minute)return;this.lastMinute=city.minute;const members=new Set(council.members.map(m=>m.citizenId));for(const bill of council.bills)if(bill.status==='awaiting-session'&&!members.has(bill.authorId)&&!bill.executiveRequest){bill.status='dismissed';bill.result='Autor deixou a Câmara antes de apresentar o projeto';city.log(`Projeto arquivado antes da apresentação: ${bill.title}.`,'government',[bill.authorId],{kind:'bill-dismissed',billId:bill.id});}const hall=this.hall();
    if(!hall||!this.workHours()){for(const c of council.people())if(c.councilSession)this.release(c);return;}
    let routed=0;
    for(const c of council.people()){
      if(c.councilSession&&c.task!=='council-session')c.councilSession=null;
      if(c.task==='council-session'){if(city.urgentNeed(c))this.release(c);continue;}
      if(routed>=2||c.deliveryId||c.cleaningJobId||c.workMeal||c.conversation||['vote','interview','care','caregiving','food','provisions','water','health','energy','toilet','workmeal'].includes(c.task)||city.urgentNeed(c)||Math.min(c.needs.food,c.needs.water,c.needs.energy,c.needs.toilet)<35||city.minute-(c.lastCouncilRouteAt??-Infinity)<30)continue;
      c.lastCouncilRouteAt=city.minute;const path=city.findPath(c.entity,hall.door);if(path===null)continue;
      c.path=path;c.task='council-session';c.targetId=hall.id;c.councilSession={buildingId:hall.id,startedAt:city.minute};c.action='Indo trabalhar na Câmara';routed++;
    }
    if(!this.open())return;
    const present=this.present(),presentIds=new Set(present.map(c=>c.id));
    for(const bill of council.bills.filter(b=>b.status==='awaiting-session'&&(b.executiveRequest?present.length>0:presentIds.has(b.authorId)))){bill.status='proposed';bill.proposedAt=city.minute;bill.voteAt=city.minute+60;bill.plenaryBuildingId=hall.id;bill.plenaryPresenterId=bill.executiveRequest?present[0].id:bill.authorId;bill.proposalEventId=city.log(`${bill.executiveRequest?`${bill.authorName} solicitou; ${present[0].entity.properties.name} apresentou no plenário`:`${bill.authorName} apresentou no plenário`}: ${bill.title}.`,'government',[bill.authorId,bill.plenaryPresenterId],{kind:'bill-proposed',billId:bill.id,buildingId:hall.id,executiveRequest:!!bill.executiveRequest,parentEventId:bill.eventId}).id;}
    for(const bill of council.bills.filter(b=>b.status==='proposed'&&city.minute>=b.voteAt))council.vote(bill);
  }
}
