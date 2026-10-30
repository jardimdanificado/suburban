const clamp=(value,min=0,max=100)=>Math.max(min,Math.min(max,value));

/** Public indicators derived only from observable municipal accounts and active businesses. */
export function governmentPerformance(city){
  const fiscal=city.fiscal?.report?.(),reserve=Math.max(1,fiscal?.reserve??city.welfare?.conditions?.().reserve??1),cash=fiscal?.cash??city.treasury??0;
  const expenses=fiscal?.operatingExpenses??0,balance=fiscal?.operatingBalance??0;
  const cashHealth=clamp(cash/(reserve*2)*100);
  const operatingHealth=expenses>0?clamp(50+50*Math.tanh(balance/expenses)):balance>0?100:50;
  const firms=city.economy?.businesses||[],productive=firms.filter(b=>b.active&&!b.entity?.destroyed&&b.workers?.length>0&&(b.totalRevenue||0)>0).length;
  const companyProductivity=firms.length?productive/firms.length*100:50;
  return {cash,reserve,expenses,operatingBalance:balance,activeCompanies:firms.length,productiveCompanies:productive,cashHealth,operatingHealth,companyProductivity};
}
