import { DEVELOPMENT_RULES } from './city_development.js';
/** Permanent institutional archive; physical copies still need paper and labor. */
export class CityOfficialJournal {
  constructor(city){this.city=city;this.records=[];this.byEventId=new Map();this.printedThrough=0;this.nextEdition=1;}
  capture(event){
    if(event.kind!=='government'&&event.kind!=='construction')return;
    const action=event.data?.kind||event.kind;
    const building=this.city.building(event.buildingId);
    const publicWork=event.kind==='construction'&&['project-completed','service-completed'].includes(action)&&(event.accounts.includes('treasury')||building?.municipal||building?.units.every(u=>u.ownerId==='treasury'));
    const publicAct=event.kind==='government'&&(/^(bill-|mayor-|term-|election-|runoff-|voting-|council-|executive-|promise-|politician-impeached|corruption-investigation|corruption-proven|official-)/.test(action)||event.billId!=null);
    if(!publicAct&&!publicWork)return;
    const bill=event.billId!=null?this.city.politics?.council.bills.find(b=>b.id===event.billId):null;
    const record=Object.freeze({id:event.id,minute:event.minute,message:event.message,action,billId:event.billId??null,
      partyId:event.partyId??null,termId:event.termId??null,electionId:event.electionId??null,projectId:event.projectId??null,corruptionCaseId:event.corruptionCaseId??null,
      votes:Object.freeze((bill?.votes||[]).map(v=>Object.freeze({...v}))),
      absences:Object.freeze((bill?.absences||[]).map(v=>Object.freeze({...v}))),
      yes:event.yes??bill?.yes??null,no:event.no??bill?.no??null,threshold:event.threshold??bill?.threshold??null,
      leadershipBallots:Object.freeze((action==='council-president-elected'?this.city.politics.council.leaderElections.at(-1)?.ballots||[]:[]).map(v=>Object.freeze({...v,voterName:this.city.society.citizen(v.voterId)?.entity.properties.name||String(v.voterId),candidateName:this.city.society.citizen(v.candidateId)?.entity.properties.name||String(v.candidateId)})))});
    this.records.push(record);this.byEventId.set(record.id,record);
  }
  get pending(){return this.records.length-this.printedThrough;}
  ensure(){
    const city=this.city;
    const existing=city.buildings.find(b=>b.officialJournal&&!b.entity.destroyed)||city.buildings.find(b=>b.type==='newsroom'&&b.municipal&&!b.entity.destroyed);
    if(existing){
      existing.officialJournal=true;existing.newsGenre='política';existing.entity.properties.name='Jornal Oficial do Município';
      const target=city.currency.price(40000),available=Math.max(0,city.treasury-city.welfare.conditions().reserve);
      if(existing.balance<target&&available>0)city.transfer('treasury',existing.accountId,Math.min(target-existing.balance,available),'Custeio do Jornal Oficial');
      return;
    }
    if(city.development.projects.some(p=>p.officialJournal&&!p.cancelled&&p.status!=='completed'))return;
    const needs=city.welfare.conditions(),cost=4*DEVELOPMENT_RULES.stonePerCell*city.economy.goods.pedra.price+city.currency.price(4*DEVELOPMENT_RULES.constructionFeePerCell*DEVELOPMENT_RULES.municipalMultiplier+20000);
    if(city.treasury<=needs.reserve+cost)return;
    const lots=city.development.plots.filter(p=>p.ownerId==='treasury'&&!p.projectId&&!p.buildingId&&!['farm','quarry'].includes(p.type)&&p.width>=2&&p.depth>=2)
      .sort((a,b)=>Math.hypot(a.x-city.spawn.x,a.y-city.spawn.y)-Math.hypot(b.x-city.spawn.x,b.y-city.spawn.y));
    for(const lot of lots.slice(0,8)){
      const project=city.development.beginProject('treasury',lot.id,'newsroom',{width:2,depth:2,floors:1,priority:85});
      if(project){project.officialJournal=true;project.name='Construção do Jornal Oficial do Município';return;}
    }
  }
  print(building,pages,editor){
    const city=this.city,library=city.publications,edition=this.nextEdition++;
    const doc=library.stock(building,'jornais',pages);
    Object.assign(doc,{sealed:true,official:true,genre:'política',editionKey:`oficial:${edition}`,title:`Jornal Oficial do Município · edição ${edition} · dia ${city.day}`,editorId:editor.id});
    for(const record of this.records.slice(this.printedThrough,this.printedThrough+library.capacity(doc))){
      const entry=Object.freeze({id:library.nextEntryId++,type:'event',truth:true,text:record.message,sourceEventId:record.id,sourceMinute:record.minute,eventId:record.id,
        authorId:editor.id,authorName:'Jornal Oficial do Município',writtenAt:city.minute,officialRecord:record,
        sourceSnapshot:Object.freeze({id:record.id,minute:record.minute,message:record.message,kind:'government',category:'government',truth:true,billId:record.billId,partyId:record.partyId,electionId:record.electionId,termId:record.termId,data:{kind:record.action,votes:record.votes,absences:record.absences},citizenIds:record.votes.map(v=>v.citizenId),subjects:[]})});
      doc.entries.push(entry);library.eventIndex.set(record.id,{documentId:doc.id,entry});this.printedThrough++;
    }
    building.newsEditionDay=city.day;return doc;
  }
}
