import {pendingMayorDecisions} from './city_mayor_decisions.js';
import {mayorOrder} from './city_mayor_play.js';
import {PROMISE_METRICS,describePromise} from './city_mandates.js';
import {formatMoney} from './city_ui_format.js';
import {SECRETARIATS,secretarySkillScore} from './city_secretariats.js';

function billValue(city,bill,value){
  if(['tax','businessTax','salesTax'].includes(bill.type))return `${(Number(value)*100).toFixed(1)}%`;
  if(['worksBudget','worksTransfer','mayorBudget','councilBudget','partyFund','welfare'].includes(bill.type))return formatMoney(value);
  if(bill.type==='minimumWage')return `${formatMoney(city.currency.price(value)*60)} / hora`;
  if(typeof value==='boolean')return value?'Ativado':'Desativado';
  return String(value);
}

export function renderMayorDecision(ui,p){
  const city=ui.city,decision=pendingMayorDecisions(city).find(d=>d.key===ui.mayorDecisionKey);
  if(!decision){p.note('Decisão concluída.');return;}
  p.status(decision.kind==='bill'&&!(ui.host?.controls.pauseForCouncilBills?.()??city.mayorPauseForCouncilBills===true)?'PRAZO DE VETO EM ANDAMENTO':'SIMULAÇÃO PAUSADA',decision.title);
  if(decision.kind==='bill'){
    const bill=city.politics.council.bills.find(b=>b.id===decision.billId);
    p.heading(bill.title);p.kv('Autor',bill.authorName||'Câmara municipal');
    p.kv('Votos',`${bill.yes??bill.votes.filter(v=>v.yes).reduce((sum,v)=>sum+(v.weight||1),0)} favoráveis · ${bill.no??bill.votes.filter(v=>!v.yes).reduce((sum,v)=>sum+(v.weight||1),0)} contrários (peso parlamentar)`);
    p.kv('Prazo restante',`${Math.max(0,((bill.sanctionAt??city.minute)-city.minute)/60).toFixed(1)} horas da cidade`);
    if(bill.previousValue!=null)p.kv('Regra atual',billValue(city,bill,bill.previousValue));
    if(bill.payload.value!=null)p.kv('Proposta',billValue(city,bill,bill.payload.value));
    if(bill.payload.mode)p.kv('Sistema proposto',({appointed:'Nomeação pelo prefeito',council:'Eleição pela Câmara',direct:'Eleição popular'})[bill.payload.mode]||bill.payload.mode);
    if(bill.payload.buildingType)p.kv('Obra proposta',city.buildingTypes[bill.payload.buildingType]?.label||bill.payload.buildingType);
    if(bill.payload.buildingId)p.kv('Imóvel',city.building(bill.payload.buildingId)?.entity.properties.name||'Imóvel indisponível');
    p.note((ui.host?.controls.pauseForCouncilBills?.()??city.mayorPauseForCouncilBills===true)?'A pausa para projetos da Câmara está ativada nas configurações. Sancione, vete ou desative a opção para continuar.':'O jogo continua durante o prazo de veto. Sem resposta, o projeto recebe sanção tácita e esta janela fecha. O veto pode ser derrubado pela Câmara.');
    p.buttons([{label:'SANCIONAR AGORA',click:()=>mayorOrder(ui,'sanction',{billId:bill.id})},{label:'VETAR PROJETO',click:()=>mayorOrder(ui,'veto',{billId:bill.id})}]);
    p.windowLink('LER PROJETO COMPLETO',()=>ui.openPanel({tab:'government',views:{government:'elections'},politicsTab:'council',councilView:'bills',billId:bill.id,recordWindow:true}));
    return;
  }
  const kind=decision.kind,review=kind==='government'?city.mayorCampaign.governmentReview:city.mayorCampaign.programReview;
  const gov=city.politics,person=city.society.citizen(kind==='government'?review.mayorId:review.candidateId);
  p.kv(kind==='government'?'Prefeito em exercício':'Candidatura',person?.entity.properties.name||'—');
  if(kind==='program'&&gov.active?.round!==2){
    const party=gov.party(city.mayorCampaign.partyId),election=gov.active;
    const eligible=(party?.memberIds||[]).map(id=>city.society.citizen(id)).filter(c=>c&&gov.canRun(c,'mayor',true));
    const candidate=eligible.find(c=>c.id===review.candidateId);
    if(candidate){
      ui.selectControl(p,'Candidato a prefeito',eligible.map(c=>[c.id,`${c.entity.properties.name} · popularidade ${Math.round(c.political.popularity??0)}`]),candidate.id,value=>mayorOrder(ui,'reviewCandidate',{citizenId:Number(value)}));
      const viceOptions=eligible.filter(c=>c.id!==candidate.id);
      const nomination=election.candidates.find(n=>n.partyId===party.id);
      if(nomination?.vicePartyId!=null&&nomination.vicePartyId!==party.id)p.note(`Vice da coligação: ${nomination.viceName}. A escolha respeita o acordo firmado.`);
      else if(viceOptions.length){
        const vice=viceOptions.find(c=>c.id===review.viceId)||viceOptions[0];
        ui.selectControl(p,'Candidato a vice',viceOptions.map(c=>[c.id,`${c.entity.properties.name} · popularidade ${Math.round(c.political.popularity??0)}`]),vice.id,value=>{ui.mayorSetupVice=Number(value);});
        p.kv('Vice escolhido',city.society.citizen(review.viceId)?.entity.properties.name||'Nenhum');
        p.button('ESCOLHER VICE',()=>mayorOrder(ui,'reviewVice',{citizenId:viceOptions.find(c=>c.id===ui.mayorSetupVice)?.id??vice.id}));
      }
      p.note('A escolha da chapa altera os candidatos apresentados aos eleitores e pode retirar nomes da disputa pela Câmara.');
    }
  }
  if(kind==='government'){
    p.note(review.initial?'Escolha o programa e revise as nomeações antes de assumir o controle.':'Apuração encerrada. Seu partido manteve a prefeitura: escolha o programa e forme o novo gabinete.');
    if(!review.initial&&gov.lastResult)p.windowLink('VER APURAÇÃO DA ELEIÇÃO',()=>ui.host.openElection(gov.lastResult.id,'results'));
    p.links([{label:'1 · PROMESSAS',click:()=>{ui.mayorReviewStage='promises';ui.resetScroll();},selected:ui.mayorReviewStage!=='cabinet'},{label:'2 · SECRETARIAS',click:()=>{ui.mayorReviewStage='cabinet';ui.resetScroll();},selected:ui.mayorReviewStage==='cabinet'}]);
  }
  if(kind==='government'&&ui.mayorReviewStage==='cabinet'){
    const offices=SECRETARIATS.filter(office=>(gov.policy.secretaryElectionModes?.[office.id]||'appointed')==='appointed');
    p.note('Você escolhe as pastas por nomeação. Pastas eleitas pela Câmara ou pelo povo respeitam o resultado eleitoral.');
    const office=offices.find(o=>o.id===ui.mayorSetupOffice)||offices[0];
    if(office){
      ui.selectControl(p,'Secretaria para nomeação',offices.map(o=>[o.id,o.short]),office.id,value=>{ui.mayorSetupOffice=value;ui.mayorSetupCandidate=null;});
      const current=gov.secretaries.find(row=>row.officeId===office.id);
      p.kv('Titular atual',current?.citizenName||'Cargo vago');
      const people=city.citizens.filter(c=>!c.entity.destroyed&&gov.eligible(c)&&c.id!==city.economy.mayorId&&c.id!==gov.viceMayorId&&!gov.council.members.some(m=>m.citizenId===c.id)).sort((a,b)=>secretarySkillScore(b,office)-secretarySkillScore(a,office));
      const candidate=people.find(c=>c.id===ui.mayorSetupCandidate)||people.find(c=>c.id===current?.citizenId)||people[0];
      if(candidate){
        ui.selectControl(p,'Nome para a secretaria',people.map(c=>[c.id,`${c.entity.properties.name} · aptidão ${Math.round(secretarySkillScore(c,office))}`]),candidate.id,value=>{ui.mayorSetupCandidate=Number(value);});
        p.button('NOMEAR PARA ESTA PASTA',()=>mayorOrder(ui,'appoint',{officeId:office.id,citizenId:candidate.id}));
      }else p.note('Nenhum cidadão elegível para esta nomeação.');
    }
    p.heading('COMPOSIÇÃO DO GABINETE');
    for(const row of gov.secretaries)p.kv(SECRETARIATS.find(o=>o.id===row.officeId)?.short||row.officeId,row.citizenName||'Cargo vago');
    p.button('CONFIRMAR GOVERNO E CONTINUAR',()=>mayorOrder(ui,'confirmReview',{kind}));
    return;
  }
  p.note('Escolha até três promessas. As metas entram na avaliação do mandato e na memória dos eleitores.');
  const selected=review.selected.map(metric=>review.choices.find(pr=>pr.metric===metric)).filter(Boolean);
  for(const promise of selected){p.note(describePromise(promise));p.button(`REMOVER: ${PROMISE_METRICS[promise.metric]?.label||promise.title}`,()=>mayorOrder(ui,'reviewPromises',{kind,metric:promise.metric}));}
  const options=review.choices.filter(pr=>!review.selected.includes(pr.metric));
  const choice=options.find(pr=>pr.metric===ui.mayorSetupPromise)||options[0];
  if(choice&&selected.length<3){
    ui.selectControl(p,'Promessa para o programa',options.map(pr=>[pr.metric,pr.title]),choice.metric,value=>{ui.mayorSetupPromise=value;});
    p.note(describePromise(choice));
    p.button('ADICIONAR PROMESSA',()=>mayorOrder(ui,'reviewPromises',{kind,metric:choice.metric}));
  }
  if(kind==='government')p.button('REVISAR SECRETARIAS',()=>{ui.mayorReviewStage='cabinet';ui.resetScroll();});
  else p.button('PUBLICAR PROGRAMA E CONTINUAR',()=>mayorOrder(ui,'confirmReview',{kind}));
}
