import {PARTY_FLAG_BACKGROUNDS,drawPartyFlag} from './city_party_flags.js';

const stamp=n=>`Dia ${Math.floor(n/1440)+1}, ${String(Math.floor(n%1440/60)).padStart(2,'0')}:${String(Math.floor(n%60)).padStart(2,'0')}`;

export function renderMunicipalIdentity(ui,p){
  const city=ui.city,gov=city.politics,identity=gov.ensureMunicipalIdentity();
  const propose=(type,payload)=>{const bill=gov.submitBill(type,payload);ui.notice=bill?.title?`Proposta apresentada à Câmara: ${bill.title}.`:city.lastError||'A proposta não pôde ser apresentada.';return bill;};
  const flagProposal=operation=>propose('cityFlag',{operation});
  p.heading('IDENTIDADE DA CIDADE');p.kv('Nome oficial',identity.name);p.kv('Slogan da prefeitura',identity.slogan);p.kv('Fundação',stamp(identity.foundedAt??0));p.note('Nome, slogan, símbolos, textos, cores e fundo da bandeira mudam após aprovação da Câmara.');
  const flag=identity.flag,previewHeight=Math.min(82,p.w*76/120),previewWidth=previewHeight*120/76,previewX=p.x+(p.w-previewWidth)/2;
  if(flag&&p.visible(previewHeight+8)){drawPartyFlag(p.ui.ctx,flag,previewX,p.y,previewWidth,previewHeight);p.y+=previewHeight+8;}
  p.kv('Composição',`${flag?.emblems?.length||0} símbolos · ${flag?.texts?.length||0} textos · fundo ${flag?.backgroundStyle||'chapado'}`);
  const mode=ui.identityView||'name';p.links([['name','NOME'],['slogan','SLOGAN'],['flag','BANDEIRA'],['history','HISTÓRICO']].map(([id,label])=>({label,selected:mode===id,click:()=>{ui.identityView=id;ui.resetScroll();}})));
  let inputY;
  if(mode==='name'){p.heading('NOME');p.note('Digite o novo nome completo da cidade para encaminhá-lo como projeto de lei.');inputY=p.y;p.space(24);if(inputY>=p.top&&inputY+20<=p.bottom)ui.inputAt(ui.municipalNameInput,p.x,inputY,p.w);p.space(3);p.button('APRESENTAR NOVO NOME À CÂMARA',()=>propose('cityName',{value:ui.municipalNameInput?.value||''}));
  }
  if(mode==='slogan'){p.heading('SLOGAN DA PREFEITURA');p.note('É possível substituir o slogan inteiro ou trocar um trecho específico.');inputY=p.y;p.space(24);if(inputY>=p.top&&inputY+20<=p.bottom)ui.inputAt(ui.municipalSloganInput,p.x,inputY,p.w);p.space(3);p.button('APRESENTAR NOVO SLOGAN',()=>propose('citySlogan',{value:ui.municipalSloganInput?.value||''}));
  inputY=p.y;p.space(24);if(inputY>=p.top&&inputY+20<=p.bottom)ui.inputAt(ui.municipalSloganFromInput,p.x,inputY,p.w);p.space(3);inputY=p.y;p.space(24);if(inputY>=p.top&&inputY+20<=p.bottom)ui.inputAt(ui.municipalSloganToInput,p.x,inputY,p.w);p.space(3);p.button('PROPOR TROCA DO TRECHO NO SLOGAN',()=>propose('citySlogan',{action:'replace',from:ui.municipalSloganFromInput?.value||'',to:ui.municipalSloganToInput?.value||''}));
  }
  if(mode==='flag'){p.heading('BANDEIRA MUNICIPAL');const colorInputY=p.y;p.space(24);if(colorInputY>=p.top&&colorInputY+20<=p.bottom)ui.inputAt(ui.municipalFlagColorInput,p.x,colorInputY,p.w);p.space(3);for(let index=0;index<4;index++)p.button(`PROPOR COR ${index+1} · ${flag?.colors?.[index]||flag?.foreground||'#ffffff'}`,()=>flagProposal({type:'color',index,value:ui.municipalFlagColorInput?.value||''}));
  p.buttons(['solid','stripes-horizontal','stripes-vertical','quartered','circle','triangle-hoist','saltire','cross'].map(style=>({label:`PROPOR FUNDO · ${style.toUpperCase()}`,click:()=>flagProposal({type:'background',value:style})})));p.button('SORTEAR OUTRO FUNDO PARA VOTAÇÃO',()=>flagProposal({type:'background',value:PARTY_FLAG_BACKGROUNDS[Math.floor(city.random()*PARTY_FLAG_BACKGROUNDS.length)]}));
  p.buttons([{label:'ADICIONAR SÍMBOLO',click:()=>flagProposal({type:'add-symbol'})},{label:'REMOVER ÚLTIMO SÍMBOLO',click:()=>flagProposal({type:'remove-symbol'})},{label:'TROCAR UM SÍMBOLO',click:()=>flagProposal({type:'replace-symbol',index:Math.floor(city.random()*Math.max(1,flag?.emblems?.length||1))})},{label:'REFORMULAR BANDEIRA',click:()=>flagProposal({type:'regenerate'})}]);
  p.note('Textos extras na bandeira podem ser propostos abaixo; bandeira e slogan municipal permanecem ligados quando incluem o nome ou o slogan oficial.');inputY=p.y;p.space(24);if(inputY>=p.top&&inputY+20<=p.bottom)ui.inputAt(ui.municipalFlagTextInput,p.x,inputY,p.w);p.space(3);p.buttons([{label:'ADICIONAR TEXTO À BANDEIRA',click:()=>flagProposal({type:'add-text',value:ui.municipalFlagTextInput?.value||''})},{label:'REMOVER TEXTO DA BANDEIRA',click:()=>flagProposal({type:'remove-text'})},{label:'ATUALIZAR TEXTO DA BANDEIRA',click:()=>flagProposal({type:'edit-text',index:Math.max(0,(flag?.texts?.length||1)-1),value:ui.municipalFlagTextInput?.value||''})}]);
  }
  if(mode==='history'&&identity.history?.length){p.heading('HISTÓRICO DE MUDANÇAS');for(const row of identity.history.slice(-8).reverse())p.record(stamp(row.minute),`${row.title||`${row.type==='cityName'?'Nome':row.type==='citySlogan'?'Slogan':'Bandeira'} · ${row.value}`}${row.type==='cityName'||row.type==='citySlogan'?` (antes: ${row.previousValue})`:''}`,null);}
}
