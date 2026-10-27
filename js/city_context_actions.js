import {INTERVENTIONS} from './city_interventions.js';
import {formatMoney} from './city_ui_format.js';
export function interventionAction(ui,kind,id,options={}){
 const result=ui.city.politics.intervene(kind,id,options);
 ui.notice=result===true?'Comando enviado; aguardando resultado da simulação.':result?.description||ui.city.lastError||'Não foi possível concluir a intervenção.';
 return result;
}
export function contextActions(ui,p,{person=null,business=null,vehicle=null,caseRecord=null,poll=null,election=null}={}){
 const city=ui.city,gov=city.politics,actions=[];
 const add=(kind,id,options={})=>{const spec=INTERVENTIONS[kind];actions.push({label:spec.label+(spec.cost?` · ${formatMoney(city.currency.price(spec.cost))}`:''),click:()=>interventionAction(ui,kind,id,options)});};
 if(person){for(const k of ['praise','rumor','correction'])add(k,person.id);add('divineBlessing',person.id);add('divineInspiration',person.id);for(const [need,delta,label]of [['food',55,'Saciar fome'],['health',35,'Restaurar saúde'],['energy',45,'Recuperar energia'],['food',-45,'Provocar fome']])actions.push({label:`Interferir: ${label}`,click:()=>interventionAction(ui,'divineNeed',person.id,{need,delta})});
   const nearby=city.citizens.filter(c=>c.id!==person.id&&!c.entity.destroyed&&city.society.isAdult(c)).sort((a,b)=>Math.hypot(a.entity.x-person.entity.x,a.entity.y-person.entity.y)-Math.hypot(b.entity.x-person.entity.x,b.entity.y-person.entity.y)).slice(0,4);for(const other of nearby)for(const [tone,label]of [['friendship','aproximar como amigos'],['rivalry','criar rivalidade']])actions.push({label:`${label}: ${other.entity.properties.name}`,click:()=>interventionAction(ui,'divineBond',person.id,{otherId:other.id,tone})});
   if(gov.active?.status==='campaign'&&gov.active.candidates.some(n=>n.citizenId===person.id))for(const k of ['endorsement','rally','partyFunding'])add(k,person.id);for(const [good,label] of [['bicicleta','bicicleta'],['bicicleta_carga','bicicleta de carga'],['patinete','patinete'],['patins','patins'],['skate','skate']])actions.push({label:`Importar ${label} · ${formatMoney(Math.ceil(city.economy.goods[good].price*1.5))}`,click:()=>interventionAction(ui,'importVehicle',person.id,{good})});}
 if(business?.active&&!business.entity.destroyed){if(city.economy.businesses.includes(business))add('businessFunding',business.id);add('divineRepair',business.id);if(business.type==='farm')add('divineHarvest',business.id);
   if(business.type==='bank'){actions.push({label:'Interferir: injetar R$ 25.000 no banco',click:()=>interventionAction(ui,'divineBankLiquidity',business.id,{amount:2500000})});for(const loan of city.bank.loans.filter(l=>l.bankId===business.id&&!['paid','written-off'].includes(l.status)).slice(0,8))actions.push({label:`Perdoar dívida #${loan.id} · ${city.accountName(loan.clientId)}`,click:()=>interventionAction(ui,'divineDebtRelief',business.id,{loanId:loan.id})});}
   if(business.type==='townhall'){for(const amount of [100000,1000000,10000000])actions.push({label:`Emitir para o tesouro · ${formatMoney(city.currency.price(amount))}`,click:()=>interventionAction(ui,'divineTreasury',business.id,{amount})});for(const [category,label]of [['wages','salário'],['food','alimentos'],['services','serviços']])actions.push({label:`Decreto: ${label} ±2 pontos percentuais`,click:()=>{const before=category==='wages'?city.taxRate:city.politics.policy.salesTaxes?.[category]??.08;interventionAction(ui,'divineDecree',business.id,{category:category==='wages'?null:category,value:Math.max(0,Math.min(.5,before+(before>.1?-.02:.02)))});}});}
   if(business.type==='council_chamber')add('divineConvocation',business.id);
 }
 if(vehicle?.active&&!vehicle.scrapped)add('ride',vehicle.id);
 if(caseRecord){add('expose',caseRecord.accusedId,{caseId:caseRecord.id});add('shield',caseRecord.accusedId,{caseId:caseRecord.id});}
 if(election?.status==='campaign'){add('debate',null);for(const n of election.candidates||[])for(const [kind,label]of [['divineCampaign','Soprar apoio para'],['divineSmear','Espalhar suspeita contra']])actions.push({label:`${label} ${n.name}`,click:()=>interventionAction(ui,kind,n.citizenId)});}
 if(['voting','counting'].includes(election?.status))add('divineTurnout',null);
 if(poll&&gov.active?.status==='campaign'&&!poll.manipulated)for(const candidate of gov.active.candidates)actions.push({label:`Adulterar para ${candidate.name}`,click:()=>interventionAction(ui,'rigPoll',candidate.citizenId,{pollId:poll.id})});
 if(!actions.length)return;if(!ui.section){p.buttons?.(actions);return;}ui.section(p,`context-actions:${person?.id??business?.id??vehicle?.id??caseRecord?.id??poll?.id??election?.id}`,'INTERVIR AQUI',q=>{for(const action of actions)q.button(action.label,action.click);});
}
