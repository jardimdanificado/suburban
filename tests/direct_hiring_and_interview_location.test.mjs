import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,finishActivityRoute} from './helpers/city.mjs';
import {career,apply,routeToInterview,advanceRecruitment,directAppoint,appointTrustedCandidates,renderResume} from '../js/city_employment.js';
import {playerAction} from '../js/character_player_actions.js';

function staffLaborAgency(city){
  city.politics.ensureSecretaries();
  const office=city.politics?.secretaries?.find(r=>r.officeId==='labor'),secretary=city.society.citizen(office?.citizenId),agency=city.building(office?.buildingId)||city.buildings.find(b=>b.type==='townhall'&&b.active);
  assert(secretary&&agency,'labor agency and secretary exist');
  secretary.jobId=agency.id;secretary.task='work';secretary.targetId=agency.id;secretary.path=[];
  const unit=agency.units.find(u=>u.z===0)||agency.units[0];
  secretary.indoorLocation={buildingId:agency.id,unitId:unit.id,roomType:unit.roomType,position:{x:agency.entity.x+unit.x+.5,y:agency.entity.y+unit.y+.5,z:0},path:[],exiting:false};
  return {secretary,agency};
}

function cleanCandidate(city,c){
  city.economy.leaveJob(c);
  c.career={jobs:[],applications:[],worked:{},motivation:50};
  c.needs=Object.fromEntries(Object.keys(c.needs).map(k=>[k,95]));
  c.indoorLocation=null;c.workCell=null;c.conversation=null;c.path=[];c.task=null;
}

test('open-air workplaces (quarry, farm) always interview at the labor agency, even when secretary is absent or policy requests employer',()=>{
  const city=setup({starter:true,population:48});
  city.minute=9*60;
  const {secretary,agency}=staffLaborAgency(city);
  const quarry=city.buildings.find(b=>b.type==='quarry'&&b.constructionKind==='open-air');
  const farm=city.buildings.find(b=>b.type==='farm'&&b.constructionKind==='open-air');
  assert(quarry,'open-air quarry exists');
  quarry.active=true;quarry.jobs=2;quarry.workers=[];quarry.balance=quarry.wage*500;
  city.economy.configureEmployment(quarry.id,{interviewLocation:'employer'});
  assert.equal(quarry.hiringPolicy.interviewLocation,'agency');

  // Even when the labor secretary is absent, open-air workplaces must still route to the labor agency, never on-site.
  secretary.task=null;
  const candidates=city.citizens.filter(c=>city.society.isAdult(c)&&!city.politics.officeHolder(c)&&!c.businessIds.length).slice(0,2);
  for(const c of candidates)cleanCandidate(city,c);
  const appQ=apply(city,candidates[0],quarry);
  assert.equal(appQ.recruitmentChannel,'agency');
  assert.equal(appQ.agencyBuildingId,agency.id);

  if(farm){
    farm.active=true;farm.jobs=2;farm.workers=[];farm.balance=farm.wage*500;
    const appF=apply(city,candidates[1],farm);
    assert.equal(appF.recruitmentChannel,'agency');
    assert.equal(appF.agencyBuildingId,agency.id);
  }
});

test('closed-building workplaces can interview either at the labor agency or at the company building',()=>{
  const city=setup({starter:true,population:48});
  city.minute=9*60;
  staffLaborAgency(city);
  const buildingFirm=city.buildings.find(b=>b.type==='builder'&&b.constructionKind!=='open-air');
  assert(buildingFirm,'closed-building firm exists');
  buildingFirm.active=true;buildingFirm.jobs=2;buildingFirm.workers=[];buildingFirm.balance=buildingFirm.wage*500;
  buildingFirm.hiringPolicy={minSkill:0,minExperienceMinutes:0,minRating:0,allowTraining:true,interviewLocation:'auto'};

  const [c1,c2]=city.citizens.filter(c=>city.society.isAdult(c)&&!city.politics.officeHolder(c)&&!c.businessIds.length);
  cleanCandidate(city,c1);cleanCandidate(city,c2);

  city.economy.configureEmployment(buildingFirm.id,{interviewLocation:'agency'});
  const a1=apply(city,c1,buildingFirm);
  assert.equal(a1.recruitmentChannel,'agency');
  assert.notEqual(a1.agencyBuildingId,buildingFirm.id);

  city.economy.configureEmployment(buildingFirm.id,{interviewLocation:'employer'});
  const a2=apply(city,c2,buildingFirm);
  assert.equal(a2.recruitmentChannel,'employer');
  assert.equal(a2.agencyBuildingId,buildingFirm.id);

  // Attending at the company building completes the selection process.
  city.minute=a2.interviewAt-20;c2.entity.x=buildingFirm.door.x;c2.entity.y=buildingFirm.door.y;
  assert(routeToInterview(city,c2));finishActivityRoute(city,c2);
  city.minute=a2.interviewAt;advanceRecruitment(city);
  city.minute=a2.decideAt;advanceRecruitment(city);
  city.minute=a2.resultDueAt;advanceRecruitment(city);
  assert.equal(a2.status,'aprovado');
  assert.equal(c2.jobId,buildingFirm.id);
});

test('player boss can directly hire someone without a selection process or meeting skill requirements',()=>{
  const city=setup({starter:true,population:48});
  city.minute=9*60;
  const firm=city.buildings.find(b=>b.type==='builder'&&b.active);
  const [boss,friend]=city.citizens.filter(c=>city.society.isAdult(c)&&!city.politics.officeHolder(c)&&!c.businessIds.length);
  cleanCandidate(city,boss);cleanCandidate(city,friend);
  boss.playerManaged=true;
  firm.municipal=false;firm.ownerId=boss.id;boss.businessIds=[firm.id];
  firm.jobs=2;firm.workers=[];firm.balance=firm.wage*500;
  city.economy.configureEmployment(firm.id,{minSkill:95,minExperienceMinutes:1000,allowTraining:false});
  friend.skills[city.economy.jobSkill(firm)]=1;

  // Player uses direct-hire action without any application or interview.
  const ok=playerAction(city,boss,'direct-hire',{buildingId:firm.id,citizenId:friend.id,reason:'Pessoa de confiança'},{stop(){},route(){}});
  assert.equal(ok,true);
  assert.equal(friend.jobId,firm.id);
  assert(firm.workers.includes(friend.id));
  const row=career(friend).jobs.at(-1);
  assert.equal(row.hiredDirectly,true);
  assert.equal(row.appointmentReason,'Pessoa de confiança');

  const lines=[];
  const p=Object.fromEntries(['heading','meter','note','button','kv','record'].map(k=>[k,(...args)=>lines.push(args.join(' '))]));
  renderResume({city,openBuilding(){}},p,friend,String);
  assert(lines.some(s=>s.includes('contratação direta')||s.includes('Sem processo seletivo')));
});

test('NPC boss automatically hires trusted or well-liked people without a selection process',()=>{
  const city=setup({starter:true,population:48});
  city.minute=9*60;
  const firm=city.buildings.find(b=>b.type==='builder'&&b.active);
  const [boss,trusted,stranger]=city.citizens.filter(c=>city.society.isAdult(c)&&!city.politics.officeHolder(c)&&!c.businessIds.length);
  cleanCandidate(city,boss);cleanCandidate(city,trusted);cleanCandidate(city,stranger);
  firm.municipal=false;firm.ownerId=boss.id;boss.businessIds=[firm.id];
  firm.jobs=2;firm.workers=[];firm.balance=firm.wage*500;firm.playerHiring=false;
  city.economy.configureEmployment(firm.id,{minSkill:95,minExperienceMinutes:1000,allowTraining:false});
  trusted.skills[city.economy.jobSkill(firm)]=0;
  stranger.skills[city.economy.jobSkill(firm)]=100;

  // Boss has high trust and affection for trusted, even though trusted has 0 skill.
  city.relationships.shift(boss,trusted,{trust:75,affection:70});
  appointTrustedCandidates(city,[firm]);

  assert.equal(trusted.jobId,firm.id);
  assert(firm.workers.includes(trusted.id));
  assert.equal(career(trusted).jobs.at(-1).hiredDirectly,true);
  assert.equal(stranger.jobId,null);
});
