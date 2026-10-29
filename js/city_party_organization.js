import {makePartyName} from './city_party_names.js';
import {ROAD_TILES,tileAt} from './city_terrain.js?v=office-demand-rollout-1';
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
export const PARTY_ORGANIZATION_RULES=Object.freeze({initialParties:4,referendumMinutes:1440,founderDistance:.55,proposalInterval:3*1440,founderCooldown:7*1440,campaignBefore:2*1440,campaignAfter:1440,contactInterval:360,maxContactsPerHour:8});
export class CityPartyOrganization {
  constructor(city){this.city=city;this.proposals=[];this.nextId=1;this.lastProposalAt=-Infinity;this.lastSearchDay=null;this.lastHour=null;this.contacts=[];this.totalContacts=0;this.totalJoined=0;}
  representation(c){
    const p=this.city.politics;
    return p.parties.filter(a=>a.active&&!a.retiring).reduce((best,a)=>{const known=p.scandals.filter(s=>s.proven&&s.partyId===a.id&&s.awareIds?.includes(c.id)).length;
      const disillusion=c.political.partyId===a.id?Math.max(0,.4-c.political.loyalty)*.6:0;
      return Math.max(best,1-p.distance(c.political.ideology,a.ideology)/1.6-known*.12-disillusion);
    },0);
  }
  eligibleFounders(a,b){
    const city=this.city,p=city.politics;
    if(!a||!b||a.entity.destroyed||b.entity.destroyed||a.id===b.id||!city.society.isAdult(a)||!city.society.isAdult(b))return false;
    p.initializeCitizen(a);p.initializeCitizen(b);
    const relation=city.society.getRelation(a,b),av=relation?.views?.[a.id],bv=relation?.views?.[b.id];
    return relation?.active!==false&&['friend','close','partner'].includes(relation?.status)&&av?.affection>=35&&bv?.affection>=35&&av.trust>=30&&bv.trust>=30&&p.distance(a.political.ideology,b.political.ideology)<=PARTY_ORGANIZATION_RULES.founderDistance&&this.representation(a)<.7&&this.representation(b)<.7;
  }
  propose(a,b){
    const city=this.city,p=city.politics;
    if(this.proposals.some(r=>['proposed','approved'].includes(r.status))||p.parties.filter(a=>a.active).length>=p.policy.partyLimit||!this.eligibleFounders(a,b))return null;
    if([a,b].some(c=>(c.political.foundingCooldownUntil||0)>city.minute||c.political.foundingProposalId))return null;
    const ideology=Object.freeze(Object.fromEntries(['economy','liberty','green'].map(key=>[key,(a.political.ideology[key]+b.political.ideology[key])/2])));
    const origin=c=>c.political.partyId||((city.minute-(c.political.lastPartyDepartureAt??-Infinity)<3*p.termRules.termMinutes)?c.political.lastPartyId:null);
    const parentId=origin(a)&&origin(a)===origin(b)?origin(a):null,parent=p.party(parentId);
    const id=this.nextId++,proposal={id,founderIds:[a.id,b.id],founderNames:[a.entity.properties.name,b.entity.properties.name],ideology,parentPartyId:parent?.id??null,...makePartyName(city,ideology,[...p.parties,...this.proposals],p.nextPartyId,{parentParty:parent}),proposedAt:city.minute,voteAt:city.minute+PARTY_ORGANIZATION_RULES.referendumMinutes,status:'proposed',ballots:[],yes:0,no:0,abstentions:0};
    this.proposals.push(proposal);if(this.proposals.length>64)this.proposals.shift();this.lastProposalAt=city.minute;
    for(const c of [a,b]){c.political.foundingProposalId=id;c.political.foundingCooldownUntil=city.minute+PARTY_ORGANIZATION_RULES.founderCooldown;}
    proposal.eventId=city.log(`${proposal.founderNames.join(' e ')} propuseram ${proposal.name}; a população decidirá o registro.`,'government',proposal.founderIds,{kind:'party-foundation-proposed',partyProposalId:id,parentPartyId:proposal.parentPartyId}).id;
    return proposal;
  }
  close(proposal,status,reason){
    proposal.status=status;proposal.result=reason;proposal.decidedAt=this.city.minute;
    for(const id of proposal.founderIds){const c=this.city.society.citizen(id);if(c?.political.foundingProposalId===proposal.id)c.political.foundingProposalId=null;}
    proposal.resultEventId=this.city.log(`${proposal.name}: ${reason}`,'government',proposal.founderIds,{kind:'party-foundation-verdict',partyProposalId:proposal.id,yes:proposal.yes,no:proposal.no,abstentions:proposal.abstentions,status}).id;
  }
  verdict(proposal){
    const city=this.city,p=city.politics,[a,b]=proposal.founderIds.map(id=>city.society.citizen(id));
    if(!this.eligibleFounders(a,b)){this.close(proposal,'withdrawn','Pedido retirado: os dois fundadores já não atendem aos requisitos.');return;}
    const voters=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c));
    for(const c of voters){p.initializeCitizen(c);let vote=null,reason='Não participou';
      if(proposal.founderIds.includes(c.id)){vote=true;reason='É fundador';}
      else if(city.random()<.55+c.political.engagement*.35){
        const affinity=clamp(1-p.distance(c.political.ideology,proposal.ideology)/2.8),trust=Math.max(city.relationships.view(c,a)?.trust||0,city.relationships.view(c,b)?.trust||0)/100;
        const pluralism=.1+(c.political.ideology.liberty+1)*.08,loyalty=c.political.partyId?c.political.loyalty*.15:0;
        const chance=clamp(.08+affinity*.52+pluralism+trust*.12-loyalty-p.parties.filter(a=>a.active).length/Math.max(1,p.policy.partyLimit)*.12+(this.representation(c)<.7?.1:0),.06,.94);
        vote=city.random()<chance;reason=vote?(affinity>.8?'Afinidade com as ideias':trust>.5?'Confiança nos fundadores':'Pluralidade política'):(loyalty>.1?'Prefere o partido atual':affinity<.6?'Discorda das ideias':'Não vê necessidade de outro partido');
      }
      proposal.ballots.push(Object.freeze({citizenId:c.id,name:c.entity.properties.name,vote,reason}));
      p.remember(c,{kind:'party-foundation-vote',partyProposalId:proposal.id,eventId:proposal.eventId,description:`Consulta sobre ${proposal.name}: ${vote===null?'abstenção':vote?'votou sim':'votou não'} — ${reason}.`});
      if(vote===true)proposal.yes++;else if(vote===false)proposal.no++;else proposal.abstentions++;
    }
    proposal.electorate=voters.length;proposal.quorum=Math.max(1,Math.ceil(voters.length*.25));
    if(proposal.yes+proposal.no<proposal.quorum){this.close(proposal,'rejected','Registro rejeitado: participação abaixo de 25% do eleitorado.');return;}
    if(proposal.yes<=proposal.no){this.close(proposal,'rejected','Registro rejeitado pela maioria dos votos válidos.');return;}
    proposal.status='approved';proposal.approvedAt=city.minute;this.register(proposal);
  }
  register(proposal){
    const p=this.city.politics,city=this.city,[a,b]=proposal.founderIds.map(id=>city.society.citizen(id));
    if(!this.eligibleFounders(a,b)){this.close(proposal,'withdrawn','Registro cancelado: fundadores deixaram de atender aos requisitos.');return;}
    if(p.parties.filter(a=>a.active).length>=p.policy.partyLimit){proposal.result='Aprovado; aguardando vaga no limite de partidos.';return;}
    const adults=city.citizens.filter(c=>!c.entity.destroyed&&city.society.isAdult(c)),members=adults.filter(c=>p.party(c.political?.partyId)?.active).length,newMembers=[a,b].filter(c=>!p.party(c.political.partyId)?.active).length;
    if(members+newMembers>Math.floor(adults.length*.4)){proposal.result='Aprovado; aguardando espaço no limite de filiação.';return;}
    const party=p.createParty({proposalId:proposal.id});if(!party)return;
    for(const c of [a,b])p.join(c,party,'Fundador após aprovação popular');
    party.history.push(Object.freeze({minute:city.minute,description:`Fundado por ${proposal.founderNames.join(' e ')} após aprovação popular: ${proposal.yes} sim / ${proposal.no} não.`,partyProposalId:proposal.id}));
    party.membershipSeeded=true;party.founderIds=proposal.founderIds.slice();party.approvalId=proposal.id;proposal.partyId=party.id;
    this.close(proposal,'registered',`Registro aprovado: ${proposal.yes} sim, ${proposal.no} não e ${proposal.abstentions} abstenções.`);p.liquidateEmptyParties();
  }
  searchFounders(){
    const city=this.city,p=city.politics;if(this.lastSearchDay===city.day)return;this.lastSearchDay=city.day;
    if(city.minute-this.lastProposalAt<PARTY_ORGANIZATION_RULES.proposalInterval||p.parties.filter(a=>a.active).length>=p.policy.partyLimit||this.proposals.some(r=>['proposed','approved'].includes(r.status)))return;
    const rows=[...city.society.relations.values()];if(!rows.length)return;const offset=city.day*37%rows.length;
    for(let i=0;i<Math.min(128,rows.length);i++){const relation=rows[(offset+i)%rows.length];if(!['friend','close','partner'].includes(relation.status))continue;
      const a=city.society.citizen(relation.a),b=city.society.citizen(relation.b);if(this.propose(a,b))break;
    }
  }
  window(){
    const p=this.city.politics;if(p.termStartedAt==null)return null;const center=p.termStartedAt+p.termRules.termMinutes/2;
    return {center,from:center-PARTY_ORGANIZATION_RULES.campaignBefore,until:center+PARTY_ORGANIZATION_RULES.campaignAfter};
  }
  contact(militant,target){
    const city=this.city,p=city.politics,party=p.party(militant.political?.partyId);
    const distance=Math.hypot(target.entity.x-militant.entity.x,target.entity.y-militant.entity.y);if(target.indoorLocation||militant.indoorLocation||distance>3||!ROAD_TILES.has(tileAt(city.world,Math.floor(target.entity.x),Math.floor(target.entity.y))))return false;
    p.initializeCitizen(target);const s=target.political;
    if(!party?.active||party.retiring||target===militant||!city.society.isAdult(target)||s.partyId||s.foundingProposalId||s.membershipCooldownUntil>city.minute||city.minute-(s.lastMembershipOutreachAt??-Infinity)<PARTY_ORGANIZATION_RULES.contactInterval)return false;
    const ideological=clamp(1-p.distance(s.ideology,party.ideology)/2.8),view=city.relationships.view(target,militant),closeness=clamp(((view?.trust||0)+(view?.affection||0))/200),communication=clamp((militant.skills.social||0)/100),physical=clamp(1-distance/4);
    const quality=clamp(.2+communication*.35+(militant.traits?.empathy??.5)*.2+closeness*.2+city.random()*.2-(view?.resentment||0)/200);
    const chance=ideological>=.75?clamp((.005+.045*quality*ideological*(.35+.65*closeness)*physical)*(1-s.independence*.5),0,.06):0;
    s.lastMembershipOutreachAt=city.minute;const joined=chance>0&&city.random()<chance&&p.join(target,party,'Abordagem de militante na rua durante campanha de filiação');
    const event=city.log(`${militant.entity.properties.name} abordou ${target.entity.properties.name} sobre ${party.short}; ${joined?'houve filiação':'não houve filiação'}.`,'government',[militant.id,target.id],{kind:'party-membership-outreach',partyId:party.id,quality,communication,ideologicalAffinity:ideological,closeness,physicalDistance:distance,chance,joined});
    const record=Object.freeze({minute:city.minute,militantId:militant.id,citizenId:target.id,partyId:party.id,quality,communication,ideologicalAffinity:ideological,closeness,chance,joined,eventId:event.id});
    this.contacts.push(record);if(this.contacts.length>48)this.contacts.shift();this.totalContacts++;if(joined)this.totalJoined++;
    p.remember(target,{kind:'membership-outreach',partyId:party.id,eventId:event.id,description:`Conversou com militante de ${party.short}; ${joined?'aceitou se filiar':'permaneceu independente'}.`});return true;
  }
  arrive(c){
    const city=this.city,campaign=c.campaign,window=this.window(),party=city.politics.party(c.political?.partyId);
    if(!campaign||campaign.type!=='membership'||!party?.active||!window||city.minute>window.until||city.minute>=campaign.until||city.urgentNeed(c)){c.campaign=null;c.task=null;return;}
    c.action=`Campanha de filiação de ${party.short}`;
    if(city.minute-(campaign.lastContactAt??-Infinity)<30)return;campaign.lastContactAt=city.minute;
    const hour=Math.floor(city.minute/60);if(this.contactBudgetHour!==hour){this.contactBudgetHour=hour;this.hourContacts=0;}
    for(const target of city.citizens){if(this.hourContacts>=PARTY_ORGANIZATION_RULES.maxContactsPerHour)break;if(!target.entity.destroyed&&!city.urgentNeed(target)&&this.contact(c,target))this.hourContacts++;}
  }
  campaign(){
    const city=this.city,p=city.politics,window=this.window();
    for(const c of city.citizens)if(c.campaign?.type==='membership'&&(city.minute>=c.campaign.until||!window||city.minute>window.until||city.urgentNeed(c))){c.campaign=null;if(c.task==='campaign'){c.task=null;c.path=[];}}
    if(!window||city.minute<window.from||city.minute>window.until||city.hour<6||city.hour>=22)return;
    const parties=p.parties.filter(a=>a.active&&!a.retiring);if(!parties.length)return;
    const roads=[...city.traffic.entries()].sort((a,b)=>b[1]-a[1]).slice(0,48).map(([key])=>{const [x,y]=key.split(',').map(Number);return {x:x+.5,y:y+.5};}).filter(point=>ROAD_TILES.has(tileAt(city.world,Math.floor(point.x),Math.floor(point.y))));
    let routes=0;
    for(let i=0;i<Math.min(2,parties.length);i++){
      const party=parties[(city.hour+i)%parties.length];
      const candidates=party.memberIds.map(id=>city.society.citizen(id)).filter(c=>c&&city.society.isAdult(c)&&!p.officeHolder(c)&&!c.campaign&&!c.conversation&&!c.path.length&&!c.deliveryId&&!c.cleaningJobId&&!c.workMeal&&!city.urgentNeed(c)&&[null,'social','leisure'].includes(c.task)&&c.political.loyalty>.4).sort((a,b)=>(b.skills.social||0)-(a.skills.social||0));
      const c=candidates[0];if(!c)continue;const destination=roads.find(point=>Math.hypot(point.x-c.entity.x,point.y-c.entity.y)<=18);if(!destination)continue;
      if(routes++>=2)break;const path=city.findPath(c.entity,destination);if(path===null)continue;
      c.path=path;c.task='campaign';c.campaign={type:'membership',partyId:party.id,partyNumber:party.number,partyFlag:party.flag,flag:(c.campaignInventory?.bandeiras||0)>0?party.flag:null,until:Math.min(window.until,city.minute+120),destination};c.action=`Indo divulgar ${party.short} na rua`;
    }
  }
  hourly(){
    const hour=Math.floor(this.city.minute/60);if(this.lastHour===hour)return;this.lastHour=hour;
    for(const proposal of this.proposals){if(proposal.status==='proposed'&&this.city.minute>=proposal.voteAt)this.verdict(proposal);else if(proposal.status==='approved')this.register(proposal);}
    this.searchFounders();this.campaign();
  }
}
