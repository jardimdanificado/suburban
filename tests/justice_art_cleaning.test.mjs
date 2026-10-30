import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';
import {CityGigs} from '../js/city_gigs.js';

function fixture(){
  const people=[1,2,3].map(id=>({id,accountId:`citizen:${id}`,entity:{x:2.5,y:2.5,properties:{name:`Pessoa ${id}`}},needs:{energy:90,health:90},skills:{},path:[],businessIds:[],jobId:id===2?null:50}));
  const b={id:10,ownerId:1,type:'leisure',door:{x:2.5,y:2.5},active:true,entity:{properties:{name:'Imóvel'}},accountId:'building:10',units:[]},accounts=new Map(people.map(c=>[c.accountId,{balance:1000}]));accounts.set(b.accountId,{balance:0});
  let id=0;const city={minute:1,hour:8,world:{},buildings:[b],citizens:people,accounts,units:new Map(),society:{citizen:id=>people.find(c=>c.id===id),isAdult:()=>true},building:id=>id===10?b:null,currency:{price:n=>n},random:()=>.5,createEntity:data=>({...data,id:++id}),log:()=>({id:++id}),history:{record:()=>{}},walkable:()=>true,findPath:()=>[],urgentNeed:()=>false,economy:{practice:()=>{}},furniture:{release:()=>{}},transfer(from,to,amount){if(!accounts.has(from)||!accounts.has(to)||accounts.get(from).balance<amount||amount<=0)return false;accounts.get(from).balance-=amount;accounts.get(to).balance+=amount;return true;}};
  const justice=new CityJustice(city);city.justice=justice;city.gigs=new CityGigs(city);
  const art=justice.createArtwork({kind:'banner',message:'Mensagem original',creatorId:1,buildingId:10,x:2,y:2});
  const vandalize=message=>justice.defaceArtwork(art.id,3,message);
  const total=()=>[...accounts.values()].reduce((n,a)=>n+a.balance,0);
  const finish=job=>{for(let i=0;i<25&&job.status!=='completed'&&job.status!=='cancelled';i++){city.gigs.updateMinute();city.minute++;}};
  return {justice,city,people,art,vandalize,total,finish};
}

test('real cleaning gig pays worker and removes only the latest layer',()=>{
  const {justice,city,art,vandalize,total,finish}=fixture();vandalize('Primeiro pixo');vandalize('Segundo pixo');const before=total(),job=justice.requestArtworkCleaning(art.id);
  assert.equal(city.accounts.get('citizen:1').balance,500);assert.equal(justice.requestArtworkCleaning(art.id),false);assert.equal(art.layers.length,2);
  finish(job);assert.equal(job.status,'completed');assert.equal(art.layers.length,1);assert.equal(art.layers[0].message,'Primeiro pixo');assert.equal(art.removedLayers[0].message,'Segundo pixo');assert.equal(city.accounts.get('citizen:2').balance,1500);assert.equal(total(),before);
  assert.equal(justice.finishArtworkCleaning(job),false);
});

test('new overlay cancels stale cleaning and refunds escrow without erasing either layer',()=>{
  const {justice,city,art,vandalize,finish,total}=fixture();vandalize('Primeiro');const before=total(),job=justice.requestArtworkCleaning(art.id);vandalize('Novo');finish(job);
  assert.equal(job.status,'cancelled');assert.equal(art.layers.length,2);assert.equal(city.accounts.get('citizen:1').balance,1000);assert.equal(city.accounts.get('citizen:2').balance,1000);assert.equal(total(),before);
});

test('reparation repays actual cleaning cost only after conviction and cannot be charged twice',()=>{
  const {justice,city,art,vandalize,finish,total}=fixture();const layer=vandalize('Pixo'),record=justice.cases.find(c=>c.id===layer.caseId),before=total();const job=justice.requestArtworkCleaning(art.id);finish(job);
  record.chargedCitizenId=3;assert.equal(justice.collectReparation(record),false);record.status='convicted';assert.equal(justice.collectReparation(record),true);assert.equal(justice.collectReparation(record),false);
  assert.equal(record.reparation.paid,500);assert.equal(city.accounts.get('citizen:1').balance,1000);assert.equal(city.accounts.get('citizen:3').balance,500);assert.equal(total(),before);
});

test('removed layers retain history and future overlays never reuse their IDs',()=>{
  const {justice,art,vandalize,finish}=fixture();const layer=vandalize('Uma camada');finish(justice.requestArtworkCleaning(art.id));const next=vandalize('Outra camada');assert.ok(next.id>layer.id);assert.equal(art.removedLayers[0].id,layer.id);
});


test('reparation preserves unpaid balance when the convicted person lacks money',()=>{
  const {justice,city,art,vandalize,finish}=fixture();const layer=vandalize('Pixo'),record=justice.cases.find(c=>c.id===layer.caseId);finish(justice.requestArtworkCleaning(art.id));record.status='convicted';record.chargedCitizenId=3;
  city.accounts.get('citizen:3').balance=120;justice.collectReparation(record);assert.equal(record.reparation.paid,120);assert.equal(city.accounts.get('citizen:3').balance,0);
  assert.equal(justice.collectReparation(record),false);city.accounts.get('citizen:3').balance=500;justice.collectReparation(record);assert.equal(record.reparation.paid,500);assert.equal(city.accounts.get('citizen:3').balance,120);
});

test('unfunded owner cannot create a free cleaning job',()=>{
  const {justice,city,art,vandalize}=fixture();vandalize('Pixo');city.accounts.get('citizen:1').balance=100;
  assert.equal(justice.requestArtworkCleaning(art.id),false);assert.equal(city.gigs.jobs.length,0);assert.equal(art.layers.length,1);
});
