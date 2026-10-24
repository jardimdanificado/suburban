/** Physical paper media. Written entries are independent of journal retention. */
export const PUBLICATION_RULES=Object.freeze({bookPages:5,maxPages:32,entriesPerPage:2,writersPerHour:4});
export class CityPublications {
  constructor(city){this.city=city;this.documents=new Map();this.nextId=1;this.nextEntryId=1;this.ownerIndex=new Map();this.eventIndex=new Map();this.readerCursor=1;}
  stock(building,good,pages=PUBLICATION_RULES.bookPages){
    const doc={id:this.nextId++,good,pages:good==='panfletos'?1:pages,ownerAccountId:building.accountId,producerId:building.id,createdAt:this.city.minute,title:good==='panfletos'?'Panfleto em branco':'Livro em branco',entries:[]};
    this.documents.set(doc.id,doc);const ids=this.ownerIndex.get(doc.ownerAccountId)||[];ids.push(doc.id);this.ownerIndex.set(doc.ownerAccountId,ids);return doc;
  }
  capacity(doc){return doc.pages*PUBLICATION_RULES.entriesPerPage;}
  owned(account){return (this.ownerIndex.get(account)||[]).map(id=>this.documents.get(id)).filter(Boolean);}
  move(doc,account){const old=this.ownerIndex.get(doc.ownerAccountId)||[];this.ownerIndex.set(doc.ownerAccountId,old.filter(id=>id!==doc.id));doc.ownerAccountId=account;const ids=this.ownerIndex.get(account)||[];ids.push(doc.id);this.ownerIndex.set(account,ids);}
  inherit(from,to){for(const doc of this.owned(from))this.move(doc,to);}
  takeStock(b,c,good){
    const doc=this.owned(b.accountId).find(d=>d.good===good&&!d.entries.length)||this.stock(b,good,good==='panfletos'?1:b.bookPages||PUBLICATION_RULES.bookPages);
    this.move(doc,c.accountId);return doc;
  }
  configure(buildingId,pages){
    const b=this.city.building(buildingId);
    if(!b||b.type!=='publisher'||!Number.isInteger(pages)||pages<2||pages>PUBLICATION_RULES.maxPages)return this.city.fail('Livros devem ter entre 2 e 32 páginas.');
    b.bookPages=pages;return true;
  }
  writable(c,pamphlet=false){const docs=this.owned(c.accountId).filter(d=>d.entries.length<this.capacity(d));return (pamphlet?docs.find(d=>d.pages===1):docs.find(d=>d.pages>1))||docs[0];}
  write(documentId,authorId,{eventId=null,text='',type='information',truth=null,targetId=null,buildingId=null}={}){
    const city=this.city,doc=this.documents.get(documentId),author=city.society.citizen(authorId);
    if(!doc||!author||doc.ownerAccountId!==author.accountId||!city.society.isAdult(author))return city.fail('É preciso ser dono do livro ou panfleto para escrever.');
    if(doc.entries.length>=this.capacity(doc))return city.fail('Todas as páginas estão preenchidas.');
    if(!['event','information','propaganda','advertisement','lie'].includes(type))return city.fail('Tipo de publicação inválido.');
    const source=eventId!=null?(city.history.get(eventId)||this.eventSnapshot(eventId)):null;
    if(eventId!=null&&!source)return city.fail('O evento de origem já saiu do histórico.');
    text=String(text||source?.message||'').trim().slice(0,1200);if(!text)return city.fail('Escreva o conteúdo do registro.');
    // A faithful transcription preserves the source's truth classification; copying a lie does not make it true.
    const faithful=!!source&&text===source.message;
    const objectiveTruth=type==='lie'?false:faithful?(source.objectiveTruth??source.truth??null):truth===false?false:null;
    const item={id:this.nextEntryId++,authorId:author.id,authorName:author.entity.properties.name,writtenAt:city.minute,type,text,truth:objectiveTruth,sourceEventId:source?.id??null,sourceMinute:source?.minute??null,targetId:targetId??source?.targetId??null,buildingId:buildingId??source?.buildingId??null,electionId:source?.electionId??null,candidateId:source?.candidateId??source?.accuserId??source?.citizenIds?.[0]??null};
    const event=city.history.record('publication',`${author.entity.properties.name} escreveu: ${text}`,[author.accountId],{kind:'publication-written',publicationId:doc.id,originalEventId:item.sourceEventId,truth:objectiveTruth,contentType:type});
    item.eventId=event.id;doc.entries.push(Object.freeze(item));this.eventIndex.set(event.id,{documentId:doc.id,entry:item});
    if(doc.entries.length===1)doc.title=(doc.pages===1?'Panfleto: ':'Livro: ')+text.slice(0,72);
    author.lastAuthoredDay=city.day;return true;
  }
  eventSnapshot(eventId){
    const saved=this.eventIndex.get(Number(eventId));if(!saved)return null;
    const e=saved.entry;return {id:e.eventId,minute:e.writtenAt,message:e.text,kind:'publication',category:'publication',truth:e.truth,publicationId:saved.documentId,citizenIds:[e.authorId],data:{action:'publication-written'},subjects:[{accountId:`citizen:${e.authorId}`,name:e.authorName}]};
  }
  preserveEvent(c,event,type='event'){
    const doc=this.writable(c,type==='propaganda');if(!doc||!event)return false;
    if(doc.entries.some(e=>e.sourceEventId===event.id))return false;
    return this.write(doc.id,c.id,{eventId:event.id,type:event.truth===false?'lie':type});
  }
  read(documentId,citizenId){
    const city=this.city,doc=this.documents.get(documentId),c=city.society.citizen(citizenId);
    if(!doc||!c||!doc.entries.length)return false;
    const owner=city.accounts.get(doc.ownerAccountId),position=doc.ownerAccountId==='treasury'?city.buildings.find(b=>b.type==='townhall')?.door:owner?.door||owner?.entity;
    if(doc.ownerAccountId!==c.accountId&&(!position||Math.hypot(position.x-c.entity.x,position.y-c.entity.y)>3))return city.fail('O texto está longe demais para ser lido.');
    c.publicationReading??={};const start=c.publicationReading[doc.id]||0;if(start>=doc.entries.length)return false;
    const entry=doc.entries[start],author=city.society.citizen(entry.authorId),trust=author?(city.relationships.view(c,author)?.trust??50):40,critical=c.political?.criticalSense??.5;
    const believes=c.id===entry.authorId?entry.truth!==false:city.random()<Math.max(.1,Math.min(.95,.8-critical*.35+(trust-50)*.004));
    c.publicationReading[doc.id]=start+1;c.needs.leisure=Math.min(100,c.needs.leisure+6);city.economy.practice(c,'management',8);
    city.relationships.remember(c,{id:`publication:${doc.id}:${entry.id}`,eventId:entry.eventId,kind:'publication',actorId:entry.authorId,targetId:entry.targetId,minute:city.minute,description:`Leu ${entry.truth===false?(believes?'e acreditou':'e desconfiou'):''}: ${entry.text}`,truth:entry.truth},{otherId:entry.authorId,firsthand:false,truth:believes?entry.truth:null});
    if(entry.targetId!=null){city.politics.remember(c,{kind:entry.truth===false?'defamation':'published-account',candidateId:entry.targetId,eventId:entry.eventId,publicationId:doc.id,electionId:entry.electionId,believes,truth:entry.truth,effect:entry.truth===false&&believes?-5:0,description:`Leu em ${doc.title}: ${entry.text}`});}
    if(believes&&entry.type==='propaganda'&&city.politics.active?.id===entry.electionId){const nomination=city.politics.active.candidates.find(n=>n.citizenId===entry.candidateId);if(nomination)city.politics.campaigns.hearPromises(c,nomination,city.politics.active,'Leitura de propaganda impressa');}
    if(believes&&entry.type==='advertisement'&&entry.buildingId){c.knownAdvertisements??={};c.knownAdvertisements[entry.buildingId]=city.minute+3*1440;}
    c.lastReadPublication={documentId:doc.id,entryId:entry.id,minute:city.minute,believes};return true;
  }
  hourly(){
    const city=this.city;let budget=PUBLICATION_RULES.writersPerHour;
    for(const c of city.citizens){
      if(c.entity.destroyed||c.id%24!==city.hour||!city.society.isAdult(c)||city.urgentNeed(c))continue;
      const docs=this.owned(c.accountId);if(!docs.length)continue;
      const readable=docs.find(d=>(c.publicationReading?.[d.id]||0)<d.entries.length);if(readable)this.read(readable.id,c.id);
      if(budget<=0||c.lastAuthoredDay===city.day||!this.writable(c))continue;
      const firm=city.building(c.businessIds?.[0]);
      if(firm){if(this.write(this.writable(c,true).id,c.id,{type:'advertisement',buildingId:firm.id,text:`${firm.entity.properties.name}: ${city.buildingTypes[firm.type]?.label||firm.type}. Atendimento na localização (${Math.floor(firm.door.x)}, ${Math.floor(firm.door.y)}).`}))budget--;continue;}
      const known=(city.history.byCitizen.get(c.id)||[]).slice(-40).reverse().find(e=>!['publication','finance','production','sale','service'].includes(e.kind)&&!this.owned(c.accountId).some(d=>d.entries.some(r=>r.sourceEventId===e.id)));
      if(known&&this.preserveEvent(c,known))budget--;
    }
    // Public exchange happens only between people who are actually nearby.
    let readers=8;
    for(let scan=0;scan<Math.min(24,this.documents.size)&&readers>0;scan++){
      if(this.readerCursor>=this.nextId)this.readerCursor=1;const doc=this.documents.get(this.readerCursor++);if(!doc)continue;if(!doc.entries.length)continue;
      const owner=city.accounts.get(doc.ownerAccountId),position=doc.ownerAccountId==='treasury'?city.buildings.find(b=>b.type==='townhall')?.door:owner?.door||owner?.entity;if(!position||owner?.entity?.destroyed)continue;
      const c=city.citizens.find(c=>!c.entity.destroyed&&c.accountId!==doc.ownerAccountId&&c.id%6===city.hour%6&&(c.publicationReading?.[doc.id]||0)<doc.entries.length&&Math.hypot(c.entity.x-position.x,c.entity.y-position.y)<3);
      if(c){this.read(doc.id,c.id);readers--;}
    }
  }
}
