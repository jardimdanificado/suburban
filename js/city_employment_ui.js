import {qualification,wageFor} from './city_employment.js';
import {SKILLS} from './city_economy.js?v=business-heights-1';
import {formatMoney as money} from './city_ui_format.js';
const stamp=n=>n==null?'—':`D${Math.floor(n/1440)+1} ${String(Math.floor(n%1440/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`;
const label=c=>c?.entity.properties.name||'Pessoa ausente';
const hours=n=>`${((n||0)/60).toFixed(1)} h`;
const policyFor=b=>b.hiringPolicy||{minSkill:['clinic','mint','research_institute','cycle_workshop','bank'].includes(b.type)?15:0,minExperienceMinutes:0,minRating:0,allowTraining:true};
export function employmentReport(city){
  const firms=city.buildings.filter(b=>b.active&&!b.entity.destroyed&&b.jobs>0),byCompany=new Map(),applications=[],workers=[];
  let unemployed=0;
  for(const c of city.citizens){
    for(const [index,a] of (c.career?.applications||[]).entries()){
      const row={citizen:c,application:a,index};applications.push(row);
      let rows=byCompany.get(a.buildingId);if(!rows)byCompany.set(a.buildingId,rows=[]);rows.push(row);
    }
    if(c.entity.destroyed)continue;
    if(c.jobId&&!city.politics.officeHolder(c)){const b=city.building(c.jobId);if(b)workers.push({citizen:c,building:b,contract:c.career?.jobs.findLast(r=>r.buildingId===b.id&&r.endedAt==null)});}
    else if(!c.jobId&&!c.businessIds.length&&city.society.isAdult(c)&&!city.politics.officeHolder(c))unemployed++;
  }
  return {firms,byCompany,applications,workers,unemployed,vacancies:firms.reduce((n,b)=>n+Math.max(0,b.jobs-b.workers.length),0)};
}
const reportFor=ui=>ui.cachedList?ui.cachedList('employment-report',()=>employmentReport(ui.city)):employmentReport(ui.city);
const matches=(ui,text)=>!ui.matches||ui.matches(text);
function route(ui,view,extra={}){return ui.openPanel({tab:'economy',selected:null,query:'',views:{...ui.views,economy:view},employmentPage:0,employmentCompanyId:null,employmentCitizenId:null,employmentApplicationAt:null,...extra});}
function pages(ui,p,rows,key,draw,size=8){
  const count=Math.max(1,Math.ceil(rows.length/size)),index=Math.min(count-1,Math.max(0,ui[key]||0));
  p.note(`${rows.length} registros · página ${index+1}/${count}`);
  for(const row of rows.slice(index*size,(index+1)*size))draw(row);
  if(count>1)p.buttons([{label:'ANTERIOR',click:()=>ui.openPanel({[key]:Math.max(0,index-1)})},{label:'PRÓXIMA',click:()=>ui.openPanel({[key]:Math.min(count-1,index+1)})}]);
}
function filters(ui,p,rows){p.links(rows.map(([id,label])=>({label,selected:(ui.employmentStatus||'all')===id,click:()=>ui.openPanel({employmentStatus:id,employmentPage:0})})));}
function showPolicy(p,b){
  const policy=policyFor(b);
  p.kv('Habilidade mínima',`${policy.minSkill}/100`);p.kv('Experiência comprovada mínima',hours(policy.minExperienceMinutes));p.kv('Referências mínimas',`${policy.minRating}/100`);
  p.kv('Formação no trabalho',policy.allowTraining&&policy.minExperienceMinutes===0&&policy.minRating===0?'Aceita iniciantes com habilidade abaixo do requisito':'Exige os requisitos informados');
}
function openPersonResume(ui,c){
  if(ui.host){const state=ui.host.create(`person:${c.id}`,'people',{title:c.entity.properties.name,entity:c.entity,kind:'dossier'});state.detailTab='resume';state.resetScroll();return state;}
  return ui.openPanel({tab:'people',selected:c.entity,detailTab:'resume',mobileDetail:true,query:''});
}
function openCompanyStaff(ui,b){
  if(ui.host){const state=ui.host.create(`building:${b.id}`,'buildings',{title:b.entity.properties.name,entity:b.entity,kind:'dossier'});state.detailTab='staff';state.resetScroll();return state;}
  return ui.openPanel({tab:'buildings',selected:b.entity,detailTab:'staff',mobileDetail:true,query:''});
}
function openApplication(ui,row){route(ui,'applications',{employmentCompanyId:row.application.buildingId,employmentCitizenId:row.citizen.id,employmentApplicationAt:row.application.appliedAt,employmentStatus:'all'});}
function applicationRows(ui,p,rows,key='employmentPage'){
  const sort=()=>[...rows].sort((a,b)=>Number(b.application.status==='análise')-Number(a.application.status==='análise')||b.application.appliedAt-a.application.appliedAt||b.application.score-a.application.score),ordered=ui.cachedList?ui.cachedList(`employment-applications:${ui.employmentCompanyId??'all'}:${ui.employmentStatus||'all'}`,sort):sort();
  pages(ui,p,ordered,key,row=>{
    const {citizen:c,application:a}=row;
    p.record(label(c),`${a.status} · ${a.company} · ${stamp(a.appliedAt)}`,()=>openApplication(ui,row),false,{value:`${money(a.offeredWage*60)}/h`});
    p.kv('Seleção',`${Number(a.score||0).toFixed(1)} pontos${a.trainee?' · candidato em formação':''}`);p.note(a.reason);
  });
  if(!rows.length)p.note('Nenhuma candidatura registrada com estes filtros.');
}
function candidateDetail(ui,p,row){
  const city=ui.city,{citizen:c,application:a}=row,b=city.building(a.buildingId);
  p.heading(`CANDIDATURA · ${label(c)}`);p.kv('Empresa',a.company);p.kv('Resultado / etapa',a.status);
  p.kv('Inscrição',stamp(a.appliedAt));p.kv('Análise prevista',stamp(a.decideAt));p.kv('Decisão registrada',stamp(a.decidedAt));p.note(a.reason);
  p.kv('Oferta na candidatura',`${money(a.offeredWage*60)}/h`);p.kv('Pontuação na inscrição',Number(a.score||0).toFixed(1));
  p.button('VER VAGA E DEMAIS CANDIDATOS',()=>route(ui,'vacancies',{employmentCompanyId:a.buildingId,employmentCandidatesPage:0}));
  p.buttons([{label:'ABRIR CURRÍCULO',click:()=>openPersonResume(ui,c)},{label:'VER EMPRESA',click:()=>b&&ui.openBuilding(b.id)}]);
  if(!b){p.note('A instalação desta vaga não está mais disponível.');return;}
  const shadow={...c,career:c.career||{jobs:[],applications:[],worked:{},motivation:50}},q=qualification(city,shadow,{...b,hiringPolicy:{...policyFor(b)}}),skill=city.economy.jobSkill(b),policy=policyFor(b);
  p.heading('REQUISITOS ATUAIS × CURRÍCULO');
  p.table([{label:'Critério',weight:2},{label:'Exigido'},{label:'Candidato'}],[
    {cells:[SKILLS[skill]||skill,policy.minSkill,Number(c.skills[skill]||0).toFixed(1)]},
    {cells:['Experiência na área',hours(policy.minExperienceMinutes),hours(q.experience)]},
    {cells:['Avaliação anterior',`${policy.minRating}/100`,`${q.rating.toFixed(1)}/100`]}
  ]);
  p.note(`${q.eligible?q.trainee?'Apto para formação':'Atende aos requisitos atuais':'Não atende aos requisitos atuais'}: ${q.reason}.`);
  p.note('Requisitos e pontuação atuais podem mudar. O resultado e a justificativa acima são os registrados na candidatura.');
  p.kv('Pontuação atual',city.economy.hiringScore(shadow,b).toFixed(1));p.note('A classificação combina habilidade, horas comprovadas, referências profissionais, dedicação, reputação de confiabilidade e relação com o gestor. Uma boa pontuação não dispensa os requisitos da vaga.');p.kv('Salário atual da oferta',`${money(wageFor(city,c,b)*60)}/h`);
  const current=city.building(c.jobId);p.kv('Emprego atual',current?.entity.properties.name||'Sem vínculo assalariado');
  if(current){p.kv('Salário estimado no emprego atual',`${money(wageFor(city,c,current)*60)}/h`);if(current.id!==b.id)p.note(wageFor(city,c,b)>wageFor(city,c,current)*1.15?'A oferta supera em mais de 15% a remuneração estimada atual.':'A oferta ainda não supera o ganho mínimo de 15% usado nas trocas de emprego.');}
}
function companyDetail(ui,p,b,report){
  const city=ui.city,rows=report.byCompany.get(b.id)||[],waiting=rows.filter(r=>r.application.status==='análise');
  p.heading(b.entity.properties.name);p.metrics([['VAGAS',Math.max(0,b.jobs-b.workers.length)],['EM ANÁLISE',waiting.length],['BASE/HORA',money(b.wage*60)],['CAIXA',money(b.balance)]]);
  p.button('ABRIR EMPRESA E AJUSTAR CONTRATAÇÃO',()=>openCompanyStaff(ui,b));
  p.kv('Área profissional',SKILLS[city.economy.jobSkill(b)]||city.economy.jobSkill(b));showPolicy(p,b);
  p.kv('Equipe / capacidade',`${b.workers.length}/${b.jobs}`);p.kv('Folha base estimada por 8h trabalhadas',money(b.wage*b.workers.length*480));
  p.kv('Capacidade de pagar um minuto à equipe',b.balance>=b.wage*Math.max(1,b.workers.length)?'Caixa suficiente':'Caixa insuficiente');
  if(b.vacancySince!=null)p.kv('Vagas persistentes desde',stamp(b.vacancySince));
  p.note('O piso é a base da empresa. Habilidade pode elevar a remuneração individual; deslocamentos, insumos e trabalho efetivo limitam o total recebido.');
  p.heading('CANDIDATOS E RESULTADOS');applicationRows(ui,p,rows,'employmentCandidatesPage');
}
export function renderEmployment(ui,p){
  const report=reportFor(ui),city=ui.city,view=ui.view();
  p.heading('MERCADO DE TRABALHO');p.metrics([['VAGAS ABERTAS',report.vacancies],['SEM EMPREGO',report.unemployed],['ASSALARIADOS',report.workers.length],['EM ANÁLISE',report.applications.filter(r=>r.application.status==='análise').length]]);
  if(ui.employmentCompanyId!=null){
    p.button('VOLTAR À LISTA',()=>route(ui,view,{employmentStatus:ui.employmentStatus||'all'}));
    const row=report.applications.find(r=>r.citizen.id===ui.employmentCitizenId&&r.application.buildingId===ui.employmentCompanyId&&r.application.appliedAt===ui.employmentApplicationAt);
    if(row){candidateDetail(ui,p,row);return;}
    const b=city.building(ui.employmentCompanyId);if(b){companyDetail(ui,p,b,report);return;}
    p.note('A empresa selecionada não está mais disponível.');return;
  }
  const status=ui.employmentStatus||'all';
  if(view==='vacancies'){
    filters(ui,p,[['all','TODAS'],['entry','PRIMEIRO EMPREGO'],['experienced','EXIGE EXPERIÊNCIA'],['unfunded','SEM CAIXA']]);
    const rows=report.firms.filter(b=>b.jobs>b.workers.length&&matches(ui,`${b.entity.properties.name} ${SKILLS[city.economy.jobSkill(b)]||b.type}`)).filter(b=>status==='all'||status==='entry'&&policyFor(b).minExperienceMinutes===0&&policyFor(b).minRating===0||status==='experienced'&&policyFor(b).minExperienceMinutes>0||status==='unfunded'&&b.balance<b.wage*Math.max(1,b.workers.length+1)).sort((a,b)=>b.wage-a.wage||a.id-b.id);
    p.note('Ordenadas por salário base. Selecione uma vaga para ver os requisitos completos e todos os candidatos.');
    pages(ui,p,rows,'employmentPage',b=>{const policy=policyFor(b),waiting=(report.byCompany.get(b.id)||[]).filter(r=>r.application.status==='análise').length;
      p.record(b.entity.properties.name,`${Math.max(0,b.jobs-b.workers.length)} vagas · ${SKILLS[city.economy.jobSkill(b)]||b.type} · ${waiting} candidatos em análise`,()=>route(ui,'vacancies',{employmentCompanyId:b.id,employmentCandidatesPage:0}),false,{value:`${money(b.wage*60)}/h`});
      p.kv('Requisitos',`Habilidade ${policy.minSkill}/100 · experiência ${hours(policy.minExperienceMinutes)} · referências ${policy.minRating}/100`);
    });if(!rows.length)p.note('Nenhuma vaga aberta com estes filtros.');
  }else if(view==='applications'){
    filters(ui,p,[['all','TODOS'],['análise','EM ANÁLISE'],['aprovado','APROVADOS'],['reprovado','REPROVADOS'],['retirado','RETIRADOS']]);
    p.note('Inclui candidaturas recentes preservadas no currículo de cada pessoa. Clique para comparar requisitos, experiência e referências.');
    applicationRows(ui,p,report.applications.filter(r=>(status==='all'||r.application.status===status)&&matches(ui,`${label(r.citizen)} ${r.application.company} ${r.application.reason}`)));
  }else{
    filters(ui,p,[['all','TODOS'],['motivated','MOTIVADOS'],['low','BAIXA MOTIVAÇÃO'],['unpaid','ATRASOS REGISTRADOS']]);
    const rows=report.workers.filter(r=>matches(ui,`${label(r.citizen)} ${r.building.entity.properties.name}`)).filter(r=>status==='all'||status==='motivated'&&(r.citizen.career?.motivation??50)>=65||status==='low'&&(r.citizen.career?.motivation??50)<40||status==='unpaid'&&(r.contract?.unpaidMinutes||0)>0).sort((a,b)=>wageFor(city,b.citizen,b.building)-wageFor(city,a.citizen,a.building));
    pages(ui,p,rows,'employmentPage',({citizen:c,building:b,contract:r})=>{
      p.record(label(c),`${b.entity.properties.name} · motivação ${Math.round(c.career?.motivation??50)}%`,()=>openPersonResume(ui,c),false,{value:`${money(wageFor(city,c,b)*60)}/h`});
      p.kv('Experiência / avaliação no emprego',`${hours(r?.workedMinutes)} · ${r?.workedMinutes?`${r.rating.toFixed(1)}/100`:'Ainda sem avaliação'}`);
    });if(!rows.length)p.note('Nenhum funcionário com estes filtros.');
  }
}
export function renderCompanyRecruitment(ui,p,b){
  const report=reportFor(ui),rows=report.byCompany.get(b.id)||[],waiting=rows.filter(r=>r.application.status==='análise');
  p.heading('VAGAS E PROCESSOS SELETIVOS');p.kv('Vagas abertas / candidatos em análise',`${Math.max(0,b.jobs-b.workers.length)} / ${waiting.length}`);
  p.buttons([{label:'VER CANDIDATOS DESTA EMPRESA',click:()=>route(ui,'applications',{employmentCompanyId:b.id,employmentCandidatesPage:0})},{label:'MERCADO DE TRABALHO',click:()=>route(ui,'vacancies')}]);
}
