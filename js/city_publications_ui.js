const stamp=n=>`D${Math.floor(n/1440)+1} ${String(Math.floor(n%1440/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`;
const types={event:'Evento',information:'Informação',propaganda:'Propaganda',advertisement:'Anúncio de negócio',lie:'Mentira'};
export function renderPublications(ui,p){
  const city=ui.city,library=city.publications,doc=library.documents.get(ui.selectedPublicationId);
  p.heading('LIVROS E PANFLETOS');
  if(!doc){
    p.note('Uma página comporta dois registros. Um panfleto tem uma página; livros guardam relatos permanentemente, inclusive após o descarte do histórico geral.');
    if(ui.publicationSourceEventId){const source=(city.history.get(ui.publicationSourceEventId)||library.eventSnapshot(ui.publicationSourceEventId));p.note(`Para registrar: ${source?.message||'Evento fora da retenção'}. Escolha um exemplar pertencente a um morador.`);p.button('CANCELAR TRANSCRIÇÃO',()=>{ui.publicationSourceEventId=null;});}
    if(ui.publicationOwner){p.kv('Acervo',city.accountName(ui.publicationOwner));p.button('MOSTRAR TODOS OS ACERVOS',()=>{ui.publicationOwner=null;ui.resetScroll();});}
    const docs=ui.cachedList('publications',()=>[...library.documents.values()].filter(d=>(!ui.publicationOwner||d.ownerAccountId===ui.publicationOwner)&&ui.matches(`${d.title} ${city.accountName(d.ownerAccountId)}`)).reverse());
    p.kv('Exemplares neste filtro',docs.length);
    p.rows(docs,d=>p.record(`#${d.id} ${d.title}`,`${city.accountName(d.ownerAccountId)} · ${d.pages} página${d.pages>1?'s':''}`,()=>{ui.selectedPublicationId=d.id;ui.resetScroll();},false,{value:`${d.entries.length}/${library.capacity(d)}`}));
    if(!docs.length)p.note('Ainda não há exemplares. A prensa transforma madeira em papel; a papelaria encaderna livros e prepara panfletos para venda.');return;
  }
  p.button('VOLTAR AO ACERVO',()=>{ui.selectedPublicationId=null;ui.resetScroll();});
  p.heading(`#${doc.id} ${doc.title}`);p.kv('Dono',city.accountName(doc.ownerAccountId));p.kv('Formato',doc.pages===1?'Panfleto (uma página)':`Livro de ${doc.pages} páginas`);p.kv('Registros / capacidade',`${doc.entries.length}/${library.capacity(doc)}`);
  p.buttons([{label:'CONTEÚDO',selected:ui.publicationTab!=='write',click:()=>{ui.publicationTab='read';ui.resetScroll();}},{label:'ESCREVER',selected:ui.publicationTab==='write',click:()=>{ui.publicationTab='write';ui.resetScroll();}}]);
  const owner=city.citizens.find(c=>c.accountId===doc.ownerAccountId&&!c.entity.destroyed);
  if(ui.publicationTab==='write'){
    if(!owner||!city.society.isAdult(owner)){p.note('O exemplar precisa ser comprado por um morador adulto para ser escrito.');return;}
    if(doc.entries.length>=library.capacity(doc)){p.note('Este exemplar está cheio. O conteúdo permanece preservado.');return;}
    const source=(city.history.get(ui.publicationSourceEventId)||library.eventSnapshot(ui.publicationSourceEventId)),type=ui.publicationContentType||'information';
    p.note(`Autor: ${owner.entity.properties.name}. Próximo registro na página ${Math.floor(doc.entries.length/2)+1}.`);
    if(source){p.note(`Evento de origem: ${source.message}`);p.button('USAR TEXTO DO EVENTO',()=>{ui.publicationDraft.value=source.message;ui.publicationContentType=source.truth===false?'lie':'event';});}
    p.buttons(Object.entries(types).map(([id,label])=>({label,selected:type===id,click:()=>{ui.publicationContentType=id;}})));
    p.note('Texto a escrever (até 1.200 caracteres):');if(p.y>=p.top&&p.y+20<=p.bottom)ui.inputAt(ui.publicationDraft,p.x,p.y,p.w);p.space(25);
    p.button('ESCREVER NESTE EXEMPLAR',()=>{if(!city.publications.write(doc.id,owner.id,{eventId:source?.id??null,text:ui.publicationDraft.value,type,truth:type==='lie'?false:null,buildingId:type==='advertisement'?owner.businessIds?.[0]??null:null}))ui.notice=city.lastError;});
    p.note('Os registros ocupam espaço e não podem ser apagados. Marcar uma invenção como mentira registra sua veracidade na simulação; leitores ainda podem acreditar nela.');
    return;
  }
  if(owner)p.button(`LEITURA POR ${owner.entity.properties.name}`,()=>city.publications.read(doc.id,owner.id));
  for(const [i,entry] of doc.entries.entries()){
    p.heading(`PÁGINA ${Math.floor(i/2)+1} · REGISTRO ${i%2+1} · ${types[entry.type]||entry.type}`);
    p.note(entry.text);p.kv('Autor / data',`${entry.authorName} · ${stamp(entry.writtenAt)}`);
    p.kv('Veracidade na simulação',entry.truth===false?'Falso':entry.truth===true?'Verdadeiro':'Não verificado');
    p.button('ABRIR REGISTRO PRESERVADO',()=>ui.openEvent(entry.eventId));
  }
  if(!doc.entries.length)p.note('Exemplar em branco.');
}
