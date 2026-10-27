import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';
import {employmentReport,renderEmployment,renderCompanyRecruitment} from '../js/city_employment_ui.js';
import {sectionTitle} from '../js/city_ui_sections.js';
function fixture(){
 const city=setup({starter:true,population:48}),b=city.buildings.find(b=>b.type==='quarry'),c=city.citizens.find(c=>!city.politics.officeHolder(c));
 b.jobs=b.workers.length+2;b.hiringPolicy={minSkill:35,minExperienceMinutes:480,minRating:60,allowTraining:false};
 c.career={motivation:70,jobs:[],worked:{mining:240},applications:[{buildingId:b.id,company:b.entity.properties.name,appliedAt:500,decideAt:560,status:'análise',score:42.5,offeredWage:10,reason:'Aguardando comparação com outros candidatos'}]};
 return {city,b,c};
}
function screen(f,view,extra={}){
 const output=[],buttons=[],opened=[],created=[],ui={city:f.city,views:{economy:view},view:()=>view,matches:text=>!extra.query||text.toLowerCase().includes(extra.query.toLowerCase()),openPanel:route=>opened.push(route),openBuilding:id=>opened.push({building:id}),...extra};
 const p={};
 for(const k of ['heading','note','kv','metrics'])p[k]=(...args)=>output.push(args.flat(3).join(' '));
 p.links=p.buttons=rows=>buttons.push(...rows);p.button=(label,click)=>buttons.push({label,click});
 p.record=(title,detail,click)=>{output.push(`${title} ${detail}`);buttons.push({label:title,click});};
 p.table=(columns,rows)=>output.push(...rows.map(r=>r.cells.join(' ')));
 renderEmployment(ui,p);return {ui,p,output:output.join('\n'),buttons,opened,created};
}
test('vacancy directory exposes salary, requirements and a link to company candidates',()=>{
 const f=fixture(),s=screen(f,'vacancies');assert.match(s.output,/VAGAS ABERTAS/);assert.match(s.output,/Habilidade 35\/100/);assert.match(s.output,/8.0 h/);
 s.buttons.find(b=>b.label===f.b.entity.properties.name).click();assert.equal(s.opened[0].employmentCompanyId,f.b.id);assert.equal(s.opened[0].views.economy,'vacancies');
});
test('company vacancy dossier keeps candidates grouped with that employer and links to staff settings',()=>{
 const f=fixture(),s=screen(f,'vacancies',{employmentCompanyId:f.b.id});assert.match(s.output,/CANDIDATOS E RESULTADOS/);assert.match(s.output,/42.5 pontos/);assert.match(s.output,/mínima 8.0 h/);
 s.buttons.find(b=>b.label===f.c.entity.properties.name).click();assert.equal(s.opened[0].employmentCitizenId,f.c.id);assert.equal(s.opened[0].employmentApplicationAt,500);
});
test('application dossier compares requirements and actual proof without fabricating experience',()=>{
 const f=fixture(),s=screen(f,'applications',{employmentCompanyId:f.b.id,employmentCitizenId:f.c.id,employmentApplicationAt:500});assert.match(s.output,/REQUISITOS ATUAIS × CURRÍCULO/);assert.match(s.output,/Experiência na área 8.0 h 4.0 h/);assert.match(s.output,/Não atende aos requisitos atuais/);
 s.buttons.find(b=>b.label==='ABRIR CURRÍCULO').click();assert.equal(s.opened[0].detailTab,'resume');assert.equal(s.opened[0].mobileDetail,true);
});
test('resume and staff links open actual desktop dossiers rather than another directory',()=>{
 const f=fixture(),created=[],host={create:(...args)=>{created.push(args);return{resetScroll(){}};}};
 const s=screen(f,'applications',{host,employmentCompanyId:f.b.id,employmentCitizenId:f.c.id,employmentApplicationAt:500});
 s.buttons.find(b=>b.label==='ABRIR CURRÍCULO').click();assert.equal(created[0][0],`person:${f.c.id}`);assert.equal(created[0][2].kind,'dossier');
 const company=screen(f,'vacancies',{host,employmentCompanyId:f.b.id});company.buttons.find(b=>b.label==='ABRIR EMPRESA E AJUSTAR CONTRATAÇÃO').click();assert.equal(created[1][0],`building:${f.b.id}`);
});
test('selection status and search filters exclude unrelated applicants',()=>{
 const f=fixture();assert(!screen(f,'applications',{employmentStatus:'aprovado'}).output.includes('42.5 pontos'));
 assert.match(screen(f,'applications',{query:f.c.entity.properties.name}).output,/42.5 pontos/);
 assert.match(screen(f,'applications',{query:'inexistente'}).output,/Nenhuma candidatura/);
});
test('worker directory opens resumes and has motivation and payment filters',()=>{
 const f=fixture();f.c.jobId=f.b.id;
 const s=screen(f,'workers',{query:f.c.entity.properties.name,employmentStatus:'motivated'});assert.match(s.output,/motivação 70%/);
 s.buttons.find(b=>b.label===f.c.entity.properties.name).click();assert.equal(s.opened[0].detailTab,'resume');
 assert(!screen(f,'workers',{query:f.c.entity.properties.name,employmentStatus:'low'}).output.includes('motivação 70%'));
});
test('company staff has direct selection navigation; reports do not mutate missing careers',()=>{
 const f=fixture(),s=screen(f,'vacancies');const before=f.city.citizens.filter(c=>!c.career).length;employmentReport(f.city);assert.equal(f.city.citizens.filter(c=>!c.career).length,before);
 renderCompanyRecruitment(s.ui,s.p,f.b);s.buttons.find(b=>b.label==='VER CANDIDATOS DESTA EMPRESA').click();assert.equal(s.opened[0].employmentCompanyId,f.b.id);assert.equal(s.opened[0].views.economy,'applications');
 assert.match(sectionTitle({tab:'economy',city:f.city,employmentCompanyId:f.b.id,employmentCitizenId:f.c.id}),/Candidatura/);
});

test('desktop and mobile canvas render all work tabs and company selection dossiers',async()=>{
 const {CityUI}=await import('../js/city_ui.js'),{ManagementCanvasUI}=await import('../js/management_ui.js');
 const f=fixture();
 for(const width of [390,1100]){
  const ctx=new Proxy({}, {get:(_,key)=>key==='canvas'?{}:key==='measureText'?value=>({width:String(value).length*6}):()=>{}});
  globalThis.window={innerWidth:width,innerHeight:844,devicePixelRatio:1};
  globalThis.document={createElement:()=>({style:{},value:'',setAttribute(){},addEventListener(){},append(){},getContext:()=>ctx})};
  const canvas={clientWidth:width,clientHeight:844,getContext:()=>ctx},renderer=new ManagementCanvasUI(canvas);
  const ui=new CityUI({city:f.city,root:{append(){}},select:entity=>ui.setSelection(entity),camera(){}});ui.tab='economy';
  for(const view of ['vacancies','applications','workers']){
   ui.views.economy=view;renderer.beginFrame();assert.doesNotThrow(()=>ui.draw(renderer),`${width}px ${view}`);
   assert(ui.zones.some(z=>z.key===`economy:${view}`));
   ui.employmentCompanyId=f.b.id;renderer.beginFrame();assert.doesNotThrow(()=>ui.draw(renderer));ui.employmentCompanyId=null;
   renderer.beginFrame();assert.doesNotThrow(()=>ui.drawFloating(renderer,{x:0,y:40,w:width,h:700,kind:'module'}));
   assert(ui.zones.some(z=>z.key===`economy:${view}`));
  }
  ui.views.economy='vacancies';ui.setSelection(f.b.entity);assert.equal(ui.view(),'overview');
 }
});
