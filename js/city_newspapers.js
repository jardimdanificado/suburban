export const NEWS_GENRES=['política','cotidiano','fofocas','alimentação','moda','economia','cultura','esportes'];
const interests=(c,g)=>((Math.imul(c.id+5,g.length*97)>>>0)%100)/100;
export function newsroomGenre(b){return b.newsGenre||NEWS_GENRES[b.id%NEWS_GENRES.length];}
export function newspaperOffer(city,c,b){
  if(c.balance<city.economy.goods.jornais.price+city.currency.price(1500)||!b.inventory.jornais||interests(c,newsroomGenre(b))<.25)return null;
  const doc=city.publications.owned(b.accountId).find(d=>d.good==='jornais'&&!c.newspaperEditions?.includes(d.editionKey));
  return doc?{good:'jornais',documentId:doc.id,price:city.economy.goods.jornais.price,spec:{use:{need:'leisure',boost:8}}}:null;
}
export function printNewspaper(city,b,pages,editor){
  const library=city.publications,genre=newsroomGenre(b);b.newsGenre=genre;
  // A single editorial selection per day; copies still require paper and paid labor.
  if(b.newsEditionDay!==city.day){
    b.newsEditionDay=city.day;const recent=city.history.entries.slice(-2500);
    const events=(Array.isArray(recent)?recent:[]).length?recent:city.events;
    const words={política:/govern|elei|corrup|prefeit|vereador|partid|promess/i,cotidiano:/moradia|fome|obra|morreu|nasceu|inaugur|estrada/i,fofocas:/romanc|amizad|inimig|casou|separ|escând|famil/i,alimentação:/colheu|alimenta|comida|marmita|cozinha|fome/i,moda:/roupa|tecido|confecção|loja/i,economia:/empresa|infla|preço|negócio|produção|emprego/i,cultura:/livro|publica|papel|cultura/i,esportes:/esport|jogo|lazer/i};
    b.newsArticles=[...events].filter(e=>e?.message&&!['finance','sale','publication'].includes(e.kind)&&city.minute-(e.minute||0)<7*1440).map(e=>({e,score:(words[genre].test(e.message)?10:0)+(/elei|inaugur|morreu|escând|promess|fome/i.test(e.message)?3:0)})).filter(r=>r.score>0).sort((a,b)=>b.score-a.score||(b.e.minute||0)-(a.e.minute||0)).slice(0,5).map(({e})=>({sourceEventId:e.id,sourceMinute:e.minute,text:e.message,truth:e.objectiveTruth??e.truth??null,type:'event',targetId:e.targetId??null,corruptionCaseId:e.corruptionCaseId??null}));
    if(!b.newsArticles.length)b.newsArticles=[{type:'information',text:`Boletim de ${genre}: ${city.citizens.filter(c=>!c.entity.destroyed).length} moradores; esta edição acompanha os acontecimentos da cidade.`,truth:true}];
    b.newsSponsored=[];const election=city.politics.active;
    if(election?.status==='campaign')for(const n of election.candidates.slice((b.id+city.day)%Math.max(1,election.candidates.length)).concat(election.candidates).slice(0,2)){
      if(b.newsSponsored.some(a=>a.candidateId===n.citizenId))continue;
      const candidate=city.society.citizen(n.citizenId),party=city.politics.party(n.partyId),payer=city.politics.partyAccount(party),fee=city.currency.price(1600);
      if(!candidate||!city.transfer(payer.accountId,b.accountId,fee,'Serviço: Anúncio político em jornal',{electionId:election.id,partyId:party.id,buildingId:b.id}))continue;
      const lie=city.random()>(candidate.traits?.honesty??.5),rival=election.candidates.find(a=>a.citizenId!==n.citizenId);
      b.newsSponsored.push({type:lie&&rival?'lie':'propaganda',truth:lie&&rival?false:null,text:lie&&rival?`Publicidade paga de ${n.name}: acusa ${rival.name} de um desvio inventado de verbas municipais.`:`Publicidade paga: ${n.name}, ${party.number} · ${n.promises.map(p=>p.title).join('; ')}.`,targetId:lie&&rival?rival.citizenId:n.citizenId,candidateId:n.citizenId,electionId:election.id,sponsorAccountId:payer.accountId,paidAmount:fee});
    }
  }
  const doc=library.stock(b,'jornais',pages);Object.assign(doc,{sealed:true,genre,editionKey:`${b.id}:${city.day}`,title:`${b.entity.properties.name} · ${genre} · dia ${city.day}`,editorId:editor.id});
  for(const article of [...b.newsSponsored,...b.newsArticles].slice(0,library.capacity(doc))){const item={...article,id:library.nextEntryId++,authorId:editor.id,authorName:editor.entity.properties.name,writtenAt:city.minute};const event=city.history.record('publication',item.text,[b.accountId],{kind:'newspaper-article',publicationId:doc.id,originalEventId:item.sourceEventId,truth:item.truth,sponsorAccountId:item.sponsorAccountId});item.eventId=event.id;doc.entries.push(Object.freeze(item));library.eventIndex.set(event.id,{documentId:doc.id,entry:item});}
  return doc;
}
