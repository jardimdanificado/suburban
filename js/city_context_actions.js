import {INTERVENTIONS} from './city_interventions.js';
import {formatMoney} from './city_ui_format.js';
export function interventionAction(ui,kind,id,options={}){
 const result=ui.city.politics.executePlayerAction(kind,id,options);
 ui.notice=result===true?'Comando aplicado imediatamente.':result?.description||ui.city.lastError||'Não foi possível concluir a intervenção.';
 return result;
}
export function contextActions(ui,p,{person=null,business=null,vehicle=null,caseRecord=null,poll=null,election=null,artwork=null}={}){
 if(!interventionsVisible(ui))return;
 const city=ui.city,gov=city.politics,actions=[];
 const add=(kind,id,options={})=>{const spec=INTERVENTIONS[kind];actions.push({label:spec.label+(spec.cost?` · ${formatMoney(city.currency.price(spec.cost))}`:''),click:()=>interventionAction(ui,kind,id,options)});};
 if(person){for(const k of ['praise','rumor','correction'])add(k,person.id);   if(gov.active?.status==='campaign'&&gov.active.candidates.some(n=>n.citizenId===person.id))for(const k of ['endorsement','rally','partyFunding'])add(k,person.id);for(const [good,label] of [['bicicleta','bicicleta'],['bicicleta_carga','bicicleta de carga'],['patinete','patinete'],['patins','patins'],['skate','skate']])actions.push({label:`Importar ${label} · ${formatMoney(Math.ceil(city.economy.goods[good].price*1.5))}`,click:()=>interventionAction(ui,'importVehicle',person.id,{good})});}
 if(business?.active&&!business.entity.destroyed){if(city.economy.businesses.includes(business))add('businessFunding',business.id);for(const [service,label]of [['repair','Contratar reparo'],['cleaning','Contratar limpeza'],['garden','Contratar jardinagem'],['art','Encomendar arte']])actions.push({label,click:()=>interventionAction(ui,'serviceOrder',business.id,{service})});
   actions.push({label:'Abrir vagas com treinamento',click:()=>interventionAction(ui,'employmentOrder',business.id,{changes:{allowTraining:true,minSkill:0,minExperienceMinutes:0}})});
   if(business.type==='research_institute')for(const [service,label]of [['public-priorities','Pesquisar prioridades da população'],['market-demand','Pesquisar demanda de mercado']])actions.push({label,click:()=>interventionAction(ui,'researchOrder',business.id,{service})});
   if(business.type==='cycle_assembler')for(const good of ['bicicleta','bicicleta_carga','patinete','patins'])actions.push({label:`Encomendar lote: ${good}`,click:()=>interventionAction(ui,'assemblyOrder',business.id,{good,size:1})});
   if(business.type==='bank'){actions.push({label:'Interferir: injetar R$ 25.000 no banco',click:()=>interventionAction(ui,'divineBankLiquidity',business.id,{amount:2500000})});for(const loan of city.bank.loans.filter(l=>l.bankId===business.id&&!['paid','written-off'].includes(l.status)).slice(0,8))actions.push({label:`Perdoar dívida #${loan.id} · ${city.accountName(loan.clientId)}`,click:()=>interventionAction(ui,'divineDebtRelief',business.id,{loanId:loan.id})});}
   if(business.type==='townhall'){for(const amount of [100000,1000000,10000000])actions.push({label:`Emitir para o tesouro · ${formatMoney(city.currency.price(amount))}`,click:()=>interventionAction(ui,'divineTreasury',business.id,{amount})});for(const [category,label]of [['wages','salário'],['food','alimentos'],['services','serviços']])actions.push({label:`Decreto: ${label} ±2 pontos percentuais`,click:()=>{const before=category==='wages'?city.taxRate:city.politics.policy.salesTaxes?.[category]??.08;interventionAction(ui,'divineDecree',business.id,{category:category==='wages'?null:category,value:Math.max(0,Math.min(.5,before+(before>.1?-.02:.02)))});}});}
   if(business.type==='council_chamber')add('divineConvocation',business.id);
 }
 if(vehicle?.active&&!vehicle.scrapped)add('ride',vehicle.id);
 if(caseRecord){add('expose',caseRecord.accusedId,{caseId:caseRecord.id});add('shield',caseRecord.accusedId,{caseId:caseRecord.id});}
 if(election?.status==='campaign'){add('debate',null);for(const n of election.candidates||[])for(const [kind,label]of [['divineCampaign','Divulgar apoio para'],['divineSmear','Espalhar suspeita contra']])actions.push({label:`${label} ${n.name}`,click:()=>interventionAction(ui,kind,n.citizenId)});}
 if(['voting','counting'].includes(election?.status))add('divineTurnout',null);
 if(poll&&gov.active?.status==='campaign'&&!poll.manipulated)for(const candidate of gov.active.candidates)actions.push({label:`Adulterar para ${candidate.name}`,click:()=>interventionAction(ui,'rigPoll',candidate.citizenId,{pollId:poll.id})});
 if(artwork&&!artwork.entity.destroyed)add('removeArtwork',artwork.id);
 if(!actions.length)return;compactInterventions(ui,p,`context:${person?.id??business?.id??vehicle?.id??caseRecord?.id??poll?.id??election?.id??artwork?.id}`,actions);
}

export function interventionsVisible(ui){return ui.host?.controls?.interventionsVisible?.()??true;}
export function compactInterventions(ui,p,key,actions){
 if(!interventionsVisible(ui)||!actions.length)return;
 if(!p.disclosure){p.buttons?.(actions);return;}
 ui.helpOpen??={};const open=!!ui.helpOpen[key];const title=({'new-public-work':'Obra pública','work-priority':'Prioridade de obras','cancel-service':'Cancelar serviços','remove-art':'Retirar arte','building-services':'Serviços nos prédios','government-orders':'Governo e eleições','banking-orders':'Banco e crédito','import-vehicles':'Importar veículos','ride-vehicles':'Solicitar passeio','fund-businesses':'Financiar empresas'})[key];p.disclosure(title?`${title} · intervir…`:'Intervir…',open,()=>{ui.helpOpen[key]=!open;});if(!open)return;
 const rows=actions.map((action,index)=>({...action,value:`${index}:${action.label}`})),current=ui.interventionChoices?.[key],selected=rows.find(a=>a.value===current)||rows[0];
 if(ui.selectControl){ui.selectControl(p,key,rows.map(a=>[a.value,a.label]),selected.value,value=>{(ui.interventionChoices??={})[key]=value;});p.button('APLICAR',selected.click);}else p.buttons(actions);
}

export function interventionButton(ui,p,label,click){compactInterventions(ui,p,`command:${label}`,[{label,click}]);}
export function interventionButtons(ui,p,actions){compactInterventions(ui,p,`commands:${actions[0]?.label}`,actions);}
