import test from 'node:test';
import assert from 'node:assert/strict';
import {setup,totalMoney} from './helpers/city.mjs';
import {partyActivity} from '../js/city_party_player.js';

test('public activity pays from party funds, reaches nearby adults and respects cooldown',()=>{
 const city=setup({starter:true,population:24}),p=city.politics;
 assert(city.mayorAction('start'));
 const party=p.party(city.mayorCampaign.partyId),adults=city.citizens.filter(c=>city.society.isAdult(c)),speaker=adults[0],voter=adults[1];
 p.initializeCitizen(speaker);speaker.political.partyId=party.id;speaker.indoorLocation=null;speaker.custody=null;
 voter.indoorLocation=null;voter.custody=null;voter.entity.x=speaker.entity.x;voter.entity.y=speaker.entity.y;
 city.minute=10*60;Object.defineProperty(city,'hour',{value:10,configurable:true});city.urgentNeed=()=>false;
 const account=p.partyAccount(party);city.transfer('treasury',account.accountId,city.currency.price(1000),'Test funding');
 const before=account.balance,cash=totalMoney(city),treasury=city.treasury;
 const result=partyActivity(city,{citizenId:speaker.id,kind:'outreach',topic:'jobs'});assert(result,city.lastError);
 assert(result.audience>0);assert.equal(account.balance,before-result.fee);assert.equal(totalMoney(city),cash);assert.equal(city.treasury,treasury);
 assert(voter.political.memories.some(m=>m.kind==='party-public-activity'&&m.partyId===party.id));
 assert(!partyActivity(city,{citizenId:speaker.id,kind:'listening',topic:'food'}));
 city.minute+=120;account.balance=0;
 assert(!partyActivity(city,{citizenId:speaker.id,kind:'listening',topic:'food'}));
 assert.equal(city.mayorCampaign.activities.length,1);
});
