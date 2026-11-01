import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';

function bridgeCity(){
 const city=setup({starter:true,population:64});let link;
 for(const site of city.economy.locateBuilding('residential')){
  city.addBuilding('residential',site.x,site.y,{...site,floors:3,free:true});
  link=city.skybridgeLinksForRevision().find(item=>item.gap>1);if(link)break;
 }
 assert(link,'the test fixture must construct a real elevated connection');
 let paintworks;
 for(const site of city.economy.locateBuilding('paintworks')){paintworks=city.addBuilding('paintworks',site.x,site.y,{...site,free:true});if(paintworks)break;}
 assert(paintworks);city.economy.activateMunicipalBusiness(paintworks,100000);paintworks.inventory.tinta=5;city.paint.stock(paintworks);
 const building=city.building(link.aId);city.transfer('treasury',building.accountId,100000,'Financiamento do cenário');
 const artist=city.citizens.find(person=>!city.politics.officeHolder(person));city.economy.leaveJob(artist,'Cenário de instalação artística');artist.businessIds=[];artist.task=null;artist.skills.artistic=60;artist.needs.energy=95;artist.needs.health=95;
 return {city,link,building,artist};
}

function runJob(city,job,observe){
 for(let i=0;i<2400&&job.status!=='completed'&&job.status!=='cancelled';i++){city.update(.25);observe?.();}
 assert.equal(job.status,'completed',job.waitingReason||city.lastError||'serviço não concluiu');
}

test('a banner is installed on a real elevated link and its cleaning worker returns by the same physical route',()=>{
 const {city,link,building,artist}=bridgeCity();
 const installation=city.gigs.createArtworkOrder(building.accountId,building.id,{kind:'banner',message:'Arte na passarela',supportKind:'skybridge',supportLinkId:link.id,supportEndpoint:'start',preferredArtistId:artist.id});assert.ok(installation);
 let crossed=false;runJob(city,installation,()=>{crossed||=artist.skybridgeZ>0||artist.skybridgeTransit?.phase==='crossing';});assert(crossed,'the installer must physically board and cross the link');
 const piece=city.justice.art.find(item=>item.id===installation.artworkId);assert.ok(piece);assert.equal(piece.support.kind,'skybridge');assert.equal(piece.support.linkId,link.id);assert.equal(piece.scene.height,link.height);assert.equal(artist.skybridgeZ||0,0);assert.equal(artist.skybridgeTransit,null);
 artist.entity.x=(link.start.x+link.end.x)/2;artist.entity.y=(link.start.y+link.end.y)/2;artist.skybridgeZ=link.height;artist.skybridgeId=link.id;assert.equal(city.justice.canObserve(artist,piece.entity,piece.scene),true);
 assert.ok(city.justice.defaceArtwork(piece.id,artist.id,'Protesto na passarela'));const cleaning=city.justice.requestArtworkCleaning(piece.id);assert.ok(cleaning);let cleaningCrossed=false;const cleaner=()=>city.society.citizen(cleaning.workerId);runJob(city,cleaning,()=>{const c=cleaner();cleaningCrossed||=!!c&&(c.skybridgeZ>0||c.skybridgeTransit?.phase==='crossing');});
 assert(cleaningCrossed,'the cleaning worker must physically reach the elevated artwork');assert.equal(piece.layers.length,0);assert.equal(cleaner().skybridgeZ||0,0);assert.equal(cleaner().skybridgeTransit,null);
});
