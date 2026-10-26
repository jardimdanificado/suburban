import test from 'node:test';
import assert from 'node:assert/strict';
import {renderResearchDirectory} from '../js/city_research_ui.js';
import {POLITICS_GROUPS} from '../js/city_ui_sections.js';
function screen(studies,options={}){
  const output=[],buttons=[],opened=[],research={studies,institutes:()=>[]},ui={politicsTab:'research-services',city:{politics:{policy:{},getResearch:()=>research}},matches:text=>!options.query||text.toLowerCase().includes(options.query),openPanel:value=>opened.push(value),...options};
  const panel={heading:text=>output.push(text),note:text=>output.push(text),kv:(k,v)=>output.push(`${k}: ${v}`),metrics:rows=>output.push(...rows.map(r=>r.join(': '))),links:rows=>buttons.push(...rows),buttons:rows=>buttons.push(...rows),button:(label,click)=>buttons.push({label,click}),windowLink:(label,click)=>buttons.push({label,click}),record:(title,detail,click)=>{output.push(`${title}: ${detail}`);buttons.push({label:title,click});},block:(title,detail,draw)=>{output.push(title,detail);draw(panel);}};
  renderResearchDirectory(ui,panel);return{output:output.join('\n'),buttons,opened};
}
const report={id:1,mode:'service',serviceType:'market-demand',status:'published',requesterName:'Mercado Central',instituteName:'Instituto Horizonte',completedAt:600,report:{sampleSize:12,rows:[{label:'Padaria',score:85}]}},pending={id:2,mode:'service',serviceType:'public-priorities',status:'collecting',requesterName:'Prefeitura',instituteName:'Instituto Horizonte',responses:[],target:20,reason:'Contrato preservado; equipe priorizando pesquisa eleitoral'};

test('non-electoral reports have a direct institution destination and published results open their dossier',()=>{
  assert(POLITICS_GROUPS.find(([id])=>id==='institutions')[2].includes('research-services'));
  const s=screen([report,{id:3,electionId:1,instituteName:'Somente eleitoral',status:'published'}]);assert.match(s.output,/RESULTADOS PUBLICADOS/);assert.match(s.output,/Mercado Central/);assert.match(s.output,/Padaria/);assert(!s.output.includes('Somente eleitoral'));
  s.buttons.find(b=>b.label==='ABRIR RELATÓRIO COMPLETO').click();assert.deepEqual(s.opened[0],{tab:'government',views:{government:'elections'},politicsTab:'research-services',studyId:1});
});

test('unfinished service contracts show progress and the actual reason rather than implying a missing published result',()=>{
  const s=screen([pending]);assert.match(s.output,/Nenhum relatório publicado/);assert.match(s.output,/0\/20 entrevistas/);assert.match(s.output,/priorizando pesquisa eleitoral/);
});

test('service directories can be searched by subject and contractor, and handle a genuinely empty history',()=>{
  assert.match(screen([report,pending],{query:'mercado central'}).output,/Padaria/);assert(!screen([report,pending],{query:'mercado central'}).output.includes('0/20 entrevistas'));
  assert.match(screen([]).output,/Nenhuma pesquisa não eleitoral foi contratada ainda/);
});
