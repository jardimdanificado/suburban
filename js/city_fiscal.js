const essentialTypes=new Set(['farm','bakery','kitchen','market','greengrocer','popular_refectory','clinic','utility','cleaner','waste_collector','recycler','carrier','mint']);
export class CityFiscal {
  constructor(city){this.city=city;this.days=[];this.worksAdvance=0;this.recovered=0;this.lastRecoveryHour=null;}
  foodCost(){const city=this.city;if(this.foodMinute===city.minute)return this.foodValue;const goods=city.workMeals?.foodGoods()||['pao'];this.foodMinute=city.minute;return this.foodValue=Math.ceil(Math.min(...goods.map(g=>city.economy.goods[g]?.price||Infinity).filter(Number.isFinite))*9.6);}
  reserve(){
    const city=this.city,key=`${city.minute}:${city.citizens.length}:${city.currency.priceIndex}:${city.welfare.policy.reserve}:${city.welfare.policy.dailyBudget}`;if(this.reserveKey===key)return this.reserveValue;
    const population=city.citizens.filter(c=>!c.entity.destroyed).length,food=this.foodCost(),social=city.welfare.policy.enabled?Math.max(0,city.welfare.policy.dailyBudget||0):0;
    this.reserveKey=key;return this.reserveValue=Math.ceil(Math.max(city.currency.price(Math.max(city.welfare.policy.reserve,population*3000)),population*food*7+social*2));
  }
  category(reason,details={}){
    if(/Benefício|subsistência/.test(reason))return 'benefits';
    if(details.purpose==='public-meals'||details.costCenter==='food'||/Alimentação/.test(reason))return 'food';
    if(/Imposto/.test(reason))return 'tax';
    if(/Lucro de empresa municipal|Resultado de empresa municipal/.test(reason))return 'dividends';
    if(/Emissão|retirada.*circulação|monetária/.test(reason))return 'monetary';
    if(/obra|construção|terreno|empreendimento|cadeia|Refinanciamento|refinanciamento|Capital inicial|Capital de empresa municipal|Capital operacional do banco|estatização|fundo partidário|Fundo partidário/i.test(reason))return 'investment';
    if(/Pesquisa|pesquisa/.test(reason))return 'research';
    if(/Salário|salarial/.test(reason))return 'payroll';
    if(/Orçamento autorizado|Custeio|Subsídio empresarial/.test(reason))return 'operations';
    return 'other';
  }
  allows(amount,reason,details={}){
    if(details.essential||details.fiscalRecovery||/^(Estorno|Devolução)/.test(reason))return true;
    const category=this.category(reason,details);if(!['investment','research','operations'].includes(category))return true;
    if(category==='research'&&details.mandatoryResearch){
      const election=this.city.politics.active,study=this.city.politics.getResearch().studies.find(s=>s.id===details.studyId),due=study?Math.max(0,Math.ceil(study.budget*1.5)-(study.funded||0)):0;
      if(study?.commission&&['mayor','council'].includes(study.commission.key)&&study.electionId===election?.id&&['campaign','scheduled'].includes(election?.status)&&study.instituteId===details.buildingId&&amount<=due)return true;
    }
    if(this.city.treasury-amount>=this.reserve())return true;
    const project=details.projectId&&this.city.development.projects.find(p=>p.id===details.projectId),type=details.businessType||project?.type;if(['farm','bakery','kitchen','popular_refectory'].includes(type)&&this.city.welfare.conditions().foodDays<3&&this.city.treasury-amount>=this.foodCost()*this.city.citizens.length)return true;
    this.lastDeferred={minute:this.city.minute,reason,amount,category};return false;
  }
  record(from,to,amount,reason,details={}){
    if(!amount||from===to||from!=='treasury'&&to!=='treasury')return;
    let day=this.days.at(-1);if(day?.day!==this.city.day){day={day:this.city.day,income:0,expenses:0,receipts:{},payments:{}};this.days.push(day);if(this.days.length>60)this.days.shift();}
    const incoming=to==='treasury',category=details.fiscalRecovery?'liquidity':this.category(reason,details),table=incoming?day.receipts:day.payments;table[category]=(table[category]||0)+amount;day[incoming?'income':'expenses']+=amount;
  }
  municipal(b){return b.accountId!=='treasury'&&!b.entity.destroyed&&b.active&&!b.ownerId&&(b.municipal||b.units?.length&&b.units.every(u=>u.ownerId==='treasury'));}
  businessReserve(b){
    const city=this.city,plan=city.vehicles?.recipeFor(b),inputs=plan?.inputs||city.buildingTypes[b.type]?.inputs||{},materials=Object.entries(inputs).reduce((n,[g,q])=>n+q*(city.economy.goods[g]?.price||0),0)*(plan?.size||1)*3;
    return Math.ceil(Math.max(city.currency.price(['bank','builder'].includes(b.type)?200000:40000),b.workers.length*b.wage*480*7,materials,(b.fiscalDailyExpenses||0)*3));
  }
  distribute(b,emergency=false){
    if(!this.municipal(b))return 0;const surplus=Math.max(0,b.balance-this.businessReserve(b)),profit=Math.max(0,b.totalRevenue-b.totalExpenses-(b.fiscalDistributedProfit||0)),amount=Math.floor(emergency?surplus:Math.min(surplus,profit*.5));
    if(amount&&this.city.transfer(b.accountId,'treasury',amount,emergency?'Resultado de empresa municipal para reserva social':'Lucro de empresa municipal',{buildingId:b.id,fiscalRecovery:emergency})){if(emergency)this.recovered+=amount;b.fiscalDistributedProfit=(b.fiscalDistributedProfit||0)+Math.min(amount,profit);return amount;}return 0;
  }
  hourly(){
    const city=this.city,hour=Math.floor(city.minute/60);if(this.lastRecoveryHour===hour)return;this.lastRecoveryHour=hour;const reserve=this.reserve();
    if(city.treasury<reserve){this.requestRevenueReview();for(const b of city.buildings){this.distribute(b,true);if(city.treasury>=reserve)break;}
      const works=city.accounts.get('works-budget'),amount=Math.min(works?.balance||0,Math.max(0,reserve-city.treasury));if(amount&&city.transfer('works-budget','treasury',amount,'Adiantamento do orçamento de obras para subsistência',{fiscalRecovery:true})){this.worksAdvance+=amount;this.recovered+=amount;city.politics.policy.worksBudget=works.balance;city.log('Verba de obras ainda não contratada adiantada para proteger alimentação e benefícios.','economy',[],{kind:'fiscal-emergency-liquidity',amount,worksAdvance:this.worksAdvance});}
    }else if(this.worksAdvance>0){const amount=Math.min(this.worksAdvance,Math.max(0,city.treasury-reserve*1.25));if(amount&&city.transfer('treasury','works-budget',amount,'Recomposição do adiantamento da verba de obras',{fiscalRecovery:true})){this.worksAdvance-=amount;city.politics.policy.worksBudget=city.accounts.get('works-budget').balance;}}
  }
  requestRevenueReview(){
    const city=this.city,p=city.politics;if(this.lastRevenueReviewDay===city.day||this.days.length<3)return;this.lastRevenueReviewDay=city.day;
    if(this.report().operatingBalance>=0)return;
    const pending=p.council.bills.find(b=>b.type==='businessTax'&&b.payload.value>p.policy.businessTax&&['awaiting-session','proposed','awaiting-sanction','executing','vetoed'].includes(b.status));if(pending){this.revenueReviewBillId=pending.id;return;}
    const author=p.council.people().find(c=>c.political.partyId===p.partyOfId(city.economy.mayorId)?.id)||p.council.people()[0];if(!author)return;
    const value=Math.min(.3,Math.max(.02,(p.policy.businessTax||0)+.02));if(value<=p.policy.businessTax)return;
    const bill=p.council.propose(author,'businessTax',{value},'Revisão fiscal: financiar alimentação e subsistência com resultado empresarial');if(bill&&typeof bill==='object'){bill.fiscalReview=true;this.revenueReviewBillId=bill.id;city.log('Déficit de custeio encaminhado à Câmara: proposta de receita para sustentar alimentação e benefícios.','government',[author.id],{kind:'fiscal-stabilization-proposed',billId:bill.id});}
  }
  daily(){for(const b of this.city.buildings){const expenses=Math.max(0,b.totalExpenses-(b.fiscalLastExpenses||0));b.fiscalLastExpenses=b.totalExpenses;b.fiscalDailyExpenses=b.fiscalDailyExpenses==null?expenses:b.fiscalDailyExpenses*.7+expenses*.3;}}
  fundServices(){
    const city=this.city;for(const b of city.buildings.filter(b=>this.municipal(b)).sort((a,b)=>Number(essentialTypes.has(b.type))-Number(essentialTypes.has(a.type)))){
      const target=Math.max(city.currency.price(20000),b.workers.length*b.wage*480*2),missing=Math.max(0,target-b.balance),available=Math.max(0,city.treasury-this.reserve()),amount=Math.min(missing,available);if(amount>0)city.transfer('treasury',b.accountId,amount,'Orçamento autorizado pelo prefeito',{buildingId:b.id,essential:false});
    }
  }
  report(){
    const since=this.city.day-6,days=this.days.filter(d=>d.day>=since),receipts={},payments={};for(const d of days){for(const [k,v]of Object.entries(d.receipts))receipts[k]=(receipts[k]||0)+v;for(const [k,v]of Object.entries(d.payments))payments[k]=(payments[k]||0)+v;}
    const income=days.reduce((n,d)=>n+d.income,0),expenses=days.reduce((n,d)=>n+d.expenses,0),financing=new Set(['investment','liquidity','monetary']),operatingIncome=Object.entries(receipts).reduce((n,[k,v])=>n+(financing.has(k)?0:v),0),operatingExpenses=Object.entries(payments).reduce((n,[k,v])=>n+(financing.has(k)?0:v),0);return{income,expenses,balance:income-expenses,operatingIncome,operatingExpenses,operatingBalance:operatingIncome-operatingExpenses,taxArrears:this.city.economy.businesses.reduce((n,b)=>n+(b.businessTaxDue||0),0),reserve:this.reserve(),cash:this.city.treasury,worksAdvance:this.worksAdvance,revenueReviewBillId:this.revenueReviewBillId,receipts,payments,days:days.length,recovered:this.recovered,lastDeferred:this.lastDeferred};
  }
}
