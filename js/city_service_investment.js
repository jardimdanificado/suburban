import { inspectBuildingSite } from './city_terrain.js';

export const ESSENTIAL_SERVICES = new Set(['quarry','builder', 'carrier', 'lamp_service', 'cleaner', 'waste_collector', 'recycler', 'composting']);

/** Turns service backlogs into financed, physically constructed premises. */
export class CityServiceInvestment {
  constructor(city) { this.city = city; this.decisions = new Map(); }
  demand(type) {
    const city = this.city;
    if(type==='quarry'){
      const firms=city.economy.businesses.filter(b=>b.type==='quarry'),reports=firms.map(b=>city.economy.quarryStatus(b)),remaining=reports.reduce((n,r)=>n+r.remaining,0),staff=reports.reduce((n,r)=>n+(r.remaining?r.staff:0),0),stock=firms.reduce((n,b)=>n+b.inventory.pedra,0),work=city.development.projects.filter(p=>!p.cancelled&&p.status!=='completed').reduce((n,p)=>n+Math.max(0,p.stone-p.inventory.pedra-(p.incoming.pedra||0)),0),capacity=reports.reduce((n,r)=>n+r.potential,0);
      const shortage=Math.max(0,work-stock-capacity),exhausted=remaining<Math.max(18,work-stock);
      return {work,capacity,remaining,staff,stock,count:firms.length,oldest:0,score:work>stock&&(exhausted||shortage>0)?Math.min(300,180+shortage):0};
    }
    if (type === 'carrier') return city.logistics.demandMetrics();
    if (type === 'lamp_service') {const posts=city.lighting.posts.filter(p=>p.built&&p.fuel<=3),firms=city.economy.businesses.filter(b=>b.type===type),staff=firms.reduce((n,b)=>n+(b.balance>=b.wage?b.workers.length:0)+(city.economy.workingOwner(b)?1:0),0),pending=city.logistics.shipments.filter(s=>s.purpose==='lamp-refill'&&!['delivered','cancelled'].includes(s.status)).length,work=posts.length*35+pending*25,capacity=staff*240;return {work,capacity,staff,count:posts.length,oldest:0,score:posts.length?Math.min(300,(staff?0:120)+Math.max(0,work-capacity*.5)*.5):0};}

    const firms = city.economy.businesses.filter(b => b.type === type);
    if(['waste_collector','recycler','composting'].includes(type)) {
      const waste=city.sanitation.wasteMetrics();
      const staff=firms.reduce((n,b)=>n+(b.balance>=b.wage?b.workers.length:0)+(city.economy.citizen(b.ownerId)?1:0),0);
      const units=type==='waste_collector'?waste.awaiting+waste.collecting:waste.total;
      const work=units*(type==='waste_collector'?8:type==='recycler'?4:5),capacity=staff*240;
      const shortage=Math.max(0,work-capacity*.5);
      return {work,capacity,staff,count:units,oldest:0,score:units>=2?Math.min(300,(staff?0:120)+shortage*.5):0};
    }
    const staff = firms.reduce((n,b) => n+(b.balance >= b.wage ? b.workers.length : 0)+(city.economy.citizen(b.ownerId) ? 1 : 0),0);
    let work = 0, oldest = 0, count = 0;
    if (type === 'cleaner') {
      const dirty = [...city.sanitation.facilities.values()].filter(f => f.cleanliness < 65);
      count = dirty.length;
      work = dirty.reduce((n,f) => n+20+(f.cleanliness < 25 ? 30 : 15),0);
      oldest = dirty.reduce((n,f) => Math.max(n,city.minute-f.lastCleanedAt),0);
    } else {
      const projects = city.development.projects.filter(p => !p.cancelled && p.status !== 'completed');
      count = projects.length;
      work = projects.reduce((n,p) => n+Math.max(0,p.requiredLabor-p.labor),0);
      oldest = projects.filter(p => p.inventory.pedra >= p.stone).reduce((n,p) => Math.max(n,city.minute-p.startedAt),0);
    }
    const capacity = staff*240;
    const deficit = Math.max(0,work-capacity*.5);
    return {work:Math.ceil(work),capacity,staff,count,oldest,score:count ? Math.min(300,(staff ? 0 : 120)+deficit*.5+(!staff || deficit>0?Math.min(90,oldest/60):0)) : 0};
  }
  pending(type) { return this.city.development.projects.filter(p => !p.cancelled && p.status !== 'completed' && p.service === 'building' && p.type === type); }
  lots(type) {
    const city = this.city;
    if(type==='quarry'){city.development.ensureQuarryPlot();return city.development.plots.filter(p=>p.ownerId==='treasury'&&!p.buildingId&&!p.projectId&&p.type==='quarry'&&!inspectBuildingSite(city,p.x,p.y,p.width,p.depth,{plotId:p.id,type}).error).sort((a,b)=>a.price-b.price||a.id-b.id);}
    return city.development.plots.filter(p => p.ownerId === 'treasury' && p.forSale && !p.buildingId && !p.projectId && !['quarry','farm'].includes(p.type) && p.width >= 3 && p.depth >= 3 && p.width <= 8 && p.depth <= 8 && !inspectBuildingSite(city,p.x,p.y,3,3,{plotId:p.id,type}).error).sort((a,b) => a.price-b.price || a.id-b.id);
  }
  plan(type, plot, municipal = false) {
    const city = this.city, stone = type==='quarry'?0:18, fee = type==='quarry'?0:type === 'builder' && !municipal ? 0 : city.currency.price(9*12000);
    const capital = city.currency.price(150000), freight = city.currency.price(24000);
    const construction = stone*city.economy.goods.pedra.price+Math.ceil(fee*(municipal?1.5:1));
    return {type,plot,width:type==='quarry'?plot.width:3,depth:type==='quarry'?plot.depth:3,stone,capital,freight,fee,selfBuild:type==='builder'&&!municipal,total:(municipal?0:plot.price)+construction+capital+freight+city.currency.price(15000)};
  }
  start(ownerId, plan, loan = null) {
    const city = this.city;
    const project = city.development.beginProject(ownerId,plan.plot.id,plan.type,{width:plan.width||3,depth:plan.depth||3,floors:1,selfBuild:plan.selfBuild,priority:150});
    if (!project) return null;
    if(project.status==='completed'){
      const b=city.buildings.find(b=>b.plotId===plan.plot.id);if(b)city.transfer(ownerId,b.accountId,Math.max(0,plan.capital+plan.freight-b.balance),'Capital operacional da nova extração',{projectId:project.id,buildingId:b.id});
    }else{
      const reserveId=`startup:${project.id}`;city.accounts.set(reserveId,{name:`Materiais e capital de ${city.buildingTypes[plan.type].label}`,balance:0});
      const reserve=plan.stone*city.economy.goods.pedra.price+plan.capital+plan.freight;
      city.transfer(ownerId,reserveId,reserve,'Reserva de materiais e capital do empreendimento');project.materialAccountId=reserveId;project.startupCapital=plan.capital;
    }
    if(plan.selfBuild && ownerId!=='treasury'){const founder=city.accounts.get(ownerId);if(founder){city.economy.leaveJob(founder,'Construção da própria empresa');founder.startupProjectId=project.id;}}
    if (loan) { loan.projectId = project.id; project.loanId = loan.id; }
    this.decisions.set(plan.type,{state:project.status==='completed'?'Operação iniciada':'Sede em construção',projectId:project.id,minute:city.minute});
    city.history.record('credit',`A demanda originou uma nova ${city.buildingTypes[plan.type].label}; sede com materiais e capital reservados.`,[ownerId,'treasury'],{projectId:project.id,amount:plan.total});
    return project;
  }
  preparePending(project, score) {
    const city=this.city;
    const priority=['waste_collector','recycler','composting'].includes(project.type)?260:project.type==='quarry'?230:project.type==='builder'?220:Math.max(100,score);
    project.priority=Math.max(project.priority||0,priority);
    if(project.materialAccountId)return true;
    const stone=Math.max(0,project.stone-project.inventory.pedra-(project.incoming.pedra||0));
    const need=stone*city.economy.goods.pedra.price+city.currency.price(174000);
    const payer=city.accounts.get(project.accountId);if(!payer)return false;
    const reserve=project.accountId==='treasury'?city.welfare.policy.reserve:city.currency.price(15000);
    let loan=null;
    if(payer.balance<need+reserve && project.accountId!=='treasury' && payer.entity?.properties.citizen){
      for(const bank of city.bank.available()){loan=city.bank.lendForBusiness(bank,payer,need+reserve-payer.balance,{type:project.type,initialChain:true,projectId:project.id,score,budget:need+reserve});if(loan)break;}
    }
    if(payer.balance<need+reserve)return false;
    const id=`startup:${project.id}`;city.accounts.set(id,{name:'Materiais e operação de prestadora',balance:0});
    city.transfer(project.accountId,id,need,'Financiamento reservado da prestadora pendente');project.materialAccountId=id;project.startupCapital=city.currency.price(150000);
    if(loan){loan.projectId=project.id;project.loanId=loan.id;}
    return true;
  }
  invest({initialOnly=false,types=null}={}) {
    const city = this.city;
    city.development.ensurePlots();
    const demands = [...ESSENTIAL_SERVICES].map(type => ({type,...this.demand(type)})).filter(d => d.score >= 60&&(!types||types.includes(d.type))&&(!initialOnly||!city.economy.businesses.some(b=>b.type===d.type))).sort((a,b) => (a.type === 'builder' ? -1 : b.type === 'builder' ? 1 : b.score-a.score));
    let started = false;
    for (const demand of demands) {
      const pending = this.pending(demand.type);
      const funded=pending.filter(p=>this.preparePending(p,demand.score));
      if (funded.length) { this.decisions.set(demand.type,{state:'Sede com materiais financiados em construção',projectId:funded[0].id,minute:city.minute}); continue; }
      const plot = this.lots(demand.type)[0];
      if (!plot) { this.decisions.set(demand.type,{state:'Aguardando terreno urbano acessível',minute:city.minute}); continue; }
      const plan = this.plan(demand.type,plot);
      const candidates = city.citizens.filter(c => city.society.isAdult(c) && !c.entity.destroyed && !city.politics.officeHolder(c) && !c.businessIds.length && !c.deliveryId && !c.cleaningJobId && !city.development.projects.some(p => p.accountId === c.accountId && !p.cancelled && p.status !== 'completed')).sort((a,b) => Number(!!a.jobId)-Number(!!b.jobId) || (b.skills[({quarry:'mining',builder:'construction',carrier:'logistics',lamp_service:'logistics',cleaner:'cleaning',waste_collector:'logistics',recycler:'recycling',composting:'recycling'})[demand.type]]||0)-(a.skills[({quarry:'mining',builder:'construction',carrier:'logistics',lamp_service:'logistics',cleaner:'cleaning',waste_collector:'logistics',recycler:'recycling',composting:'recycling'})[demand.type]]||0) || a.id-b.id);
      let project = null;
      for (const founder of candidates) {
        let loan = null;
        const need = Math.max(0,plan.total-founder.balance);
        if (need && founder.creditAllowed!==false) for (const bank of city.bank.available()) { loan = city.bank.lendForBusiness(bank,founder,need,{type:demand.type,initialChain:!city.economy.businesses.some(b=>b.type===demand.type&&(demand.type!=='quarry'||city.economy.quarryStatus(b).remaining>0)),score:demand.score,budget:plan.total}); if (loan) break; }
        if (founder.balance < plan.total) continue;
        if (city.development.buyPlot(founder.accountId,plot.id)) project = this.start(founder.accountId,plan,loan);
        if (project) break;
        // A synchronous failed opening returns the unused financing instead of creating a phantom debt.
        if (plot.ownerId === founder.accountId && !plot.projectId) { city.transfer('treasury',founder.accountId,plot.price,'Estorno de terreno de empreendimento'); plot.ownerId='treasury';plot.forSale=true; }
        if (loan) city.bank.cancelBusinessLoan(loan);
      }
      if (!project) {
        const publicPlan = this.plan(demand.type,plot,true);
        if (city.treasury >= publicPlan.total+city.welfare.policy.reserve) project = this.start('treasury',publicPlan);
      }
      if (!project) this.decisions.set(demand.type,{state:'Aguardando crédito empresarial ou orçamento municipal',minute:city.minute});
      started ||= !!project;
    }
    return started;
  }
}
