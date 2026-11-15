import {OFFICE_ONLY_TYPES} from './city_offices.js?v=office-demand-rollout-1';
// The player directs municipal priorities; execution stays in the city's systems.
export const mayorMode = city => city.mayorCampaign?.mode === 'play';
export const publicProjects = city => city.development.projects.filter(p => p.accountId === 'treasury' && !p.cancelled && p.status !== 'completed');
export function updateMayorCampaign(city) {
  const s=city.mayorCampaign;
  if(!s || s.status!=='active' || !mayorMode(city))return;
  const mayor=city.society.citizen(city.economy.mayorId);
  // A vacancy alone is not a defeat: constitutional succession must resolve first.
  if(!mayor || mayor.entity.destroyed)return;
  s.mayorId=mayor.id;
  if(mayor.political?.partyId===s.partyId)return;
  s.status='defeated';s.endedAt=city.minute;
  s.reason=`${s.partyName} perdeu a prefeitura. ${mayor.entity.properties.name} assumiu por outro partido.`;
  city.log(s.reason,'government',[mayor.id],{kind:'mayor-campaign-defeated',partyId:s.partyId});
}
function record(city, action, text, details={}) {
  const s=city.mayorCampaign;
  s.orders.push({id:s.nextOrderId++,minute:city.minute,action,text,...details});
  if(s.orders.length>80)s.orders.shift();
  city.log(text,'government',[city.economy.mayorId],{kind:'mayor-player-order',action,...details});
}
export function mayorAction(city,action,options={}) {
  city.lastError='';
  if(!options || typeof options!=='object')return city.fail('Opções inválidas.');
  const p=city.politics;
  if(action==='start'){
    if(city.mayorCampaign)return city.fail('Esta cidade já possui uma campanha de prefeito.');
    if(city.characterGame?.mode==='play'||city.familyCampaign)return city.fail('Use uma cidade sem campanha de personagem ou família.');
    p.ensureMayor();
    const mayor=city.society.citizen(city.economy.mayorId),party=p.party(mayor?.political?.partyId);
    if(!mayor||mayor.entity.destroyed||!party?.active)return city.fail('Aguarde um prefeito com partido em exercício.');
    city.mayorCampaign={version:1,mode:'play',status:'active',partyId:party.id,partyName:party.name,mayorId:mayor.id,startedAt:city.minute,orders:[],nextOrderId:1};
    record(city,'start',`O jogador assumiu a gestão de ${party.name}. Obras e serviços dependem dos recursos da cidade.`);
    return true;
  }
  const s=city.mayorCampaign;
  if(!s)return city.fail('Inicie o modo prefeito primeiro.');
  if(action==='observe'){s.mode='observe';return true;}
  if(!mayorMode(city))return city.fail('A campanha foi encerrada. Crie outra cidade para jogar novamente.');
  updateMayorCampaign(city);
  if(s.status!=='active')return city.fail('O partido perdeu a prefeitura. A campanha terminou.');
  let result,details={};
  if(action==='build'){
    if(OFFICE_ONLY_TYPES.has(options.type))return city.fail('Esta atividade precisa de um andar empresarial; a contratação direta deste modo atende instalações próprias.');
    result=p.startPublicWork(options.type,options.crop||'milho');
    if(!result)return result;
    details={projectId:result.id};
  }else if(action==='priority'){
    const project=publicProjects(city).find(p=>p.id===options.projectId);
    if(!project||![10,100,200].includes(options.value))return city.fail('Escolha uma obra pública pendente e uma prioridade válida.');
    project.priority=options.value;result=true;details={projectId:project.id,priority:options.value};
  }else if(action==='fund'){
    const b=city.building(options.buildingId),amount=options.amount;
    if(!b||!city.fiscal.municipal(b))return city.fail('Escolha uma empresa municipal em atividade.');
    if(!Number.isSafeInteger(amount)||amount<=0)return city.fail('Valor de custeio inválido.');
    if(city.treasury-amount<city.fiscal.reserve())return city.fail('Custeio consumiria a reserva municipal.');
    result=city.transfer('treasury',b.accountId,amount,'Custeio ordenado pelo prefeito',{buildingId:b.id});
    details={buildingId:b.id,amount};
  }else if(action==='service'){
    const b=city.building(options.buildingId);
    if(!b||!city.fiscal.municipal(b)&&b.id!==city.townhall()?.id)return city.fail('Escolha um imóvel municipal.');
    const methods={repair:'createRepairOrder',cleaning:'createCleaningOrder',garden:'createGardenOrder'},method=Object.hasOwn(methods,options.service)?methods[options.service]:null;
    if(!method)return city.fail('Serviço inválido.');
    const fee=city.gigs.quote(b.id,options.service==='cleaning'?'interior':options.service,'treasury');
    if(city.treasury-fee<city.fiscal.reserve())return city.fail('Serviço consumiria a reserva municipal.');
    result=city.gigs[method]('treasury',b.id,{fee});
    if(!result)return city.fail('Serviço indisponível: confira caixa, acesso, necessidade e encomendas existentes.');
    details={gigId:result.id,buildingId:b.id};
  }else if(action==='bill'){
    if(!['worksTransfer','tax','businessTax','welfare'].includes(options.type)||!Number.isFinite(options.value)||options.value<0)return city.fail('Proposta inválida.');
    if(['tax','businessTax'].includes(options.type)&&options.value>.5)return city.fail('Alíquota máxima: 50%.');
    if(['worksTransfer','welfare'].includes(options.type)&&!Number.isSafeInteger(options.value))return city.fail('Valor monetário inválido.');
    const author=options.type==='worksTransfer'?city.society.citizen(city.economy.mayorId):p.council.people().find(c=>c.political.partyId===s.partyId);
    if(!author)return city.fail('O partido precisa de um vereador para encaminhar esta proposta.');
    result=p.submitBill(options.type,{value:options.value},author.id);
    if(!result)return result;
    details={billId:result.id};
  }else if(action==='sanction'||action==='veto'){
    const bill=p.council.bills.find(b=>b.id===options.billId&&b.status==='awaiting-sanction');
    if(!bill)return city.fail('Projeto indisponível para sanção ou veto.');
    if(action==='veto')result=p.vetoBill(bill.id);
    else {p.council.execute(bill);result=true;}
    details={billId:bill.id};
  }else return city.fail('Ordem de prefeito desconhecida.');
  if(!result)return result;
  record(city,action,`Ordem de governo: ${{build:'contratar obra',priority:'alterar prioridade',fund:'destinar custeio',service:'contratar serviço',bill:'encaminhar proposta à Câmara',sanction:'sancionar projeto',veto:'vetar projeto'}[action]}.`,details);
  return result;
}
