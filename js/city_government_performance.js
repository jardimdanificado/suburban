import {isOpenJusticeCase} from './city_justice.js';
import {PAVED_ROAD_TILES,tileAt} from './city_terrain.js';
const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,value));
export const BUSINESS_REVENUE_WINDOW_DAYS=30;
export function recentBusinessRevenue(city,business){
  const today=city.day??Math.floor((city.minute||0)/1440),fromDay=today-BUSINESS_REVENUE_WINDOW_DAYS+1;
  return (business.revenueHistory||[]).reduce((sum,row)=>sum+(row.day>=fromDay?row.amount:0),0);
}

/** Public indicators derived only from observable municipal accounts and active businesses. */
export function governmentPerformance(city){
  const fiscal=city.fiscal?.report?.(),reserve=Math.max(1,fiscal?.reserve??city.welfare?.conditions?.().reserve??1),cash=fiscal?.cash??city.treasury??0;
  const expenses=fiscal?.operatingExpenses??0,balance=fiscal?.operatingBalance??0;
  const cashHealth=clamp(cash/(reserve*2)*100);
  const operatingHealth=expenses>0?clamp(50+50*Math.tanh(balance/expenses)):balance>0?100:50;
  city.businessRevenueTrackingStartedAt??=city.minute||0;
  const revenueWindowReady=(city.minute||0)-city.businessRevenueTrackingStartedAt>=BUSINESS_REVENUE_WINDOW_DAYS*1440;
  const firms=city.economy?.businesses||[],productive=firms.filter(b=>b.active&&!b.entity?.destroyed&&b.workers?.length>0&&(revenueWindowReady?recentBusinessRevenue(city,b)>0:(b.totalRevenue||0)>0)).length;
  const companyProductivity=firms.length?productive/firms.length*100:50;
  const residents=(city.citizens||[]).filter(c=>!c.entity.destroyed),adults=residents.filter(c=>city.society?.isAdult(c)&&!c.custody),occupied=adults.filter(c=>c.jobId||c.businessIds?.length||city.politics?.officeHolder(c)).length;
  const employmentHealth=adults.length?occupied/adults.length*100:50,unemploymentRate=100-employmentHealth;
  const municipal=firms.filter(b=>b.municipal||(b.equityShares?.find(s=>s.accountId==='treasury')?.points||0)>5000),insolvent=municipal.filter(b=>(b.balance||0)<Math.max(1,(b.wage||0)*Math.max(1,b.workers?.length||0)*60));
  const municipalSolvency=municipal.length?(municipal.length-insolvent.length)/municipal.length*100:100;
  const posts=(city.lighting?.posts||[]).filter(p=>p.public&&p.built),lightingHealth=posts.length?posts.filter(p=>p.fuel>0).length/posts.length*100:(city.day>7?0:50);
  let roadWeight=0,pavedWeight=0;for(const [key,traffic] of city.traffic||[]){if(!city.world?.getTile)break;const [x,y]=key.split(',').map(Number),weight=Math.max(1,Math.min(20,traffic));roadWeight+=weight;if(PAVED_ROAD_TILES.has(tileAt(city.world,x,y)))pavedWeight+=weight;}
  const overdueWorks=(city.development?.projects||[]).filter(p=>p.accountId==='treasury'&&!p.cancelled&&p.status!=='completed'&&city.minute-p.startedAt>7*1440),roadHealth=clamp((roadWeight?pavedWeight/roadWeight*100:50)-overdueWorks.filter(p=>['road','road-repair','lamp'].includes(p.service)).length*8);
  const overdueBodies=(city.justice?.bodies||[]).filter(b=>!b.crematedAt&&city.minute-b.diedAt>2*1440),funeralHealth=clamp(100-overdueBodies.length/Math.max(1,residents.length*.02)*60);
  const matureCases=(city.justice?.cases||[]).filter(c=>!['unreported','reporting'].includes(c.status)&&city.minute-(c.reportedAt??c.occurredAt??c.minute??c.createdAt??city.minute)>2*1440),unresolvedCases=matureCases.filter(isOpenJusticeCase),justiceHealth=matureCases.length?clamp(100-unresolvedCases.length/matureCases.length*100):100;
  const serviceHealth=fiscal?.serviceHealth??100,economicHealth=cashHealth*.25+operatingHealth*.15+employmentHealth*.25+municipalSolvency*.2+companyProductivity*.15,publicOrderHealth=lightingHealth*.2+roadHealth*.2+funeralHealth*.3+justiceHealth*.3,governanceHealth=economicHealth*.55+serviceHealth*.2+publicOrderHealth*.25;
  return {economicHealth,governanceHealth,publicOrderHealth,employmentHealth,unemploymentRate,municipalSolvency,insolventCompanies:insolvent.length,lightingHealth,roadHealth,funeralHealth,justiceHealth,overdueBodies:overdueBodies.length,unresolvedCases:unresolvedCases.length,overdueWorks:overdueWorks.length,cash,reserve,expenses,operatingBalance:balance,runwayDays:fiscal?.runwayDays??null,serviceHealth:fiscal?.serviceHealth??100,servicesAtRisk:fiscal?.servicesAtRisk??0,servicesTracked:fiscal?.servicesTracked??0,activeCompanies:firms.length,productiveCompanies:productive,cashHealth,operatingHealth,companyProductivity,revenueWindowReady,revenueWindowDays:BUSINESS_REVENUE_WINDOW_DAYS};
}
