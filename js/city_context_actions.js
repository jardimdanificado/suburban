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
 if(person){for(const k of ['praise','rumor','correction'])add(k,person.id);add('divineBlessing',person.id);add('divineInspiration',person.id);if(gov.active?.status==='campaign'&&gov.active.candidates.some(n=>n.citizenId===person.id))for(const k of ['endorsement','rally','partyFunding'])add(k,person.id);for(const [good,label] of [['bicicleta','bicicleta'],['bicicleta_carga','bicicleta de carga'],['patinete','patinete'],['patins','patins'],['skate','skate']])actions.push({label:`Importar ${label} · ${formatMoney(Math.ceil(city.economy.goods[good].price*1.5))}`,click:()=>interventionAction(ui,'importVehicle',person.id,{good})});}
 if(business?.active&&city.economy.businesses.includes(business)){add('businessFunding',business.id);add('divineRepair',business.id);if(business.type==='farm')add('divineHarvest',business.id);}
 if(vehicle?.active&&!vehicle.scrapped)add('ride',vehicle.id);
 if(caseRecord){add('expose',caseRecord.accusedId,{caseId:caseRecord.id});add('shield',caseRecord.accusedId,{caseId:caseRecord.id});}
 if(election?.status==='campaign')add('debate',null);
 if(poll&&gov.active?.status==='campaign'&&!poll.manipulated)for(const candidate of gov.active.candidates)actions.push({label:`Adulterar para ${candidate.name}`,click:()=>interventionAction(ui,'rigPoll',candidate.citizenId,{pollId:poll.id})});
 if(!actions.length)return;if(!ui.section){p.buttons?.(actions);return;}ui.section(p,`context-actions:${person?.id??business?.id??vehicle?.id??caseRecord?.id??poll?.id??election?.id}`,'INTERVIR AQUI',q=>{for(const action of actions)q.button(action.label,action.click);});
}
