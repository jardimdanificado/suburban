import test from 'node:test';
import assert from 'node:assert/strict';
import {CityJustice} from '../js/city_justice.js';
import {CityGigs} from '../js/city_gigs.js';

function fixture({paint=true,stone=false}={}){
 const owner={id:1,accountId:'citizen:1',jobId:50,businessIds:[],entity:{x:5.5,y:5.5,properties:{name:'Patrocinadora'}},needs:{energy:90},skills:{artistic:3},path:[]};
 const artist={id:2,accountId:'citizen:2',jobId:null,businessIds:[],entity:{x:5.5,y:5.5,properties:{name:'Artista'}},needs:{energy:90,health:90},skills:{artistic:36},path:[]};
 const site={id:10,type:'leisure',ownerId:1,active:true,entity:{x:5,y:5,destroyed:false,properties:{name:'Praça'}},accountId:'building:10',door:{x:5.5,y:5.5},width:1,depth:1,units:[]};
 const paintShop={id:20,type:'paintworks',active:true,entity:{x:7,y:5,destroyed:false,properties:{name:'Tintas'}},door:{x:7.5,y:5.5},accountId:'building:20',inventory:{tinta:paint?5:0},paintLots:paint?[{color:'#3b7baf',quantity:5,producerId:20}]:[]};
 const quarry={id:21,type:'quarry',active:true,entity:{x:8,y:5,destroyed:false,properties:{name:'Pedreira'}},door:{x:8.5,y:5.5},accountId:'building:21',inventory:{pedra:stone?5:0}};
 const accounts=new Map([['treasury',{balance:0}],['citizen:1',{balance:10000}],['citizen:2',{balance:0}],['building:10',{balance:10000}],['building:20',{balance:0}],['building:21',{balance:0}]]);
 const citizens=[owner,artist],buildings=[site,paintShop,quarry];let sequence=0;
 const city={minute:3,hour:8,day:0,world:{width:64,height:64},buildings,citizens,accounts,units:new Map(),sanitation:{streetFeces:new Map(),fecesRevision:0,cleanedFeces:0},politics:{policy:{minimumWage:5},parties:[],officeHolder:()=>false},society:{citizen:id=>citizens.find(c=>c.id===id),isAdult:()=>true},building:id=>buildings.find(b=>b.id===id)||null,walkable:()=>true,findPath:()=>[],urgentNeed:()=>false,currency:{price:n=>Math.ceil(n)},createEntity:data=>({...data,id:++sequence,destroyed:false}),log:()=>({id:++sequence}),history:{record:()=>{}},transfer(from,to,amount){const a=accounts.get(from),b=accounts.get(to);if(!a||!b||!Number.isFinite(amount)||amount<=0||a.balance<amount)return false;a.balance-=amount;b.balance+=amount;return true;}};
 city.paint={stock:b=>b.paintLots||[],available:(b,color)=>b.paintLots.filter(l=>!color||l.color===color).reduce((n,l)=>n+l.quantity,0),quote:()=>30,take(b,n,color){if(this.available(b,color)<n)return null;let left=n,out=[];for(let i=0;i<b.paintLots.length&&left;){const lot=b.paintLots[i];if(color&&lot.color!==color){i++;continue;}const quantity=Math.min(left,lot.quantity);out.push({...lot,quantity});lot.quantity-=quantity;left-=quantity;if(!lot.quantity)b.paintLots.splice(i,1);else i++;}b.inventory.tinta-=n;return out;}};
 city.economy={goods:{tinta:{price:30},pedra:{price:100}},consumed:{},recordGoods:()=>{},practice:(c,skill,n=1)=>{c.skills[skill]=(c.skills[skill]||0)+n;}};
 city.justice=new CityJustice(city);city.gigs=new CityGigs(city);return {city,site,paintShop,quarry,owner,artist};
}
function finish(city,job){for(let i=0;i<100&&job.status!=='completed'&&job.status!=='cancelled';i++){city.gigs.updateMinute();city.minute++;}}

test('a commissioned banner uses real paint, an employed artist, and transfers the remaining fee after installation',()=>{
 const {city,site,paintShop,artist}=fixture(),beforeSponsor=city.accounts.get(site.accountId).balance,job=city.gigs.createArtworkOrder(site.accountId,site.id,{kind:'banner',message:'A praça é de todos',subjectId:1,truth:false,partyId:12,commercial:true});
 assert.ok(job);assert.equal(job.status,'open');assert.equal(city.accounts.get(site.accountId).balance,beforeSponsor-job.fee);assert.equal(city.justice.art.length,0);
 finish(city,job);assert.equal(job.status,'completed');assert.equal(city.justice.art.length,1);const piece=city.justice.art[0];assert.equal(piece.kind,'banner');assert.equal(piece.message,'A praça é de todos');assert.equal(piece.creatorId,artist.id);assert.equal(piece.subjectId,1);assert.equal(piece.truth,false);assert.equal(piece.partyId,12);assert.equal(piece.commercial,true);assert.equal(piece.buildingId,site.id);assert.equal(city.economy.consumed.tinta,1);assert.equal(paintShop.inventory.tinta,4);assert.equal(city.accounts.get(paintShop.accountId).balance,30);assert.ok(city.accounts.get(artist.accountId).balance>0);assert.equal(job.artworkId,piece.id);
});

test('a commissioned statue waits for a stone supply and consumes two actual stones when installed',()=>{
 const {city,site,quarry,artist}=fixture({paint:false,stone:false}),job=city.gigs.createArtworkOrder(site.accountId,site.id,{kind:'statue',message:'Memória da cidade'});assert.ok(job);assert.match(job.waitingReason,/pedra/);
 finish(city,job);assert.equal(job.status,'open');assert.equal(job.workerId,null);assert.equal(city.justice.art.length,0);
 quarry.inventory.pedra=3;city.accounts.get(quarry.accountId).balance=0;let completed=false;for(let i=0;i<100&&!completed;i++){city.gigs.updateMinute();city.minute++;completed=job.status==='completed';}
 assert.equal(job.status,'completed');assert.equal(city.justice.art[0].kind,'statue');assert.equal(city.justice.art[0].creatorId,artist.id);assert.equal(quarry.inventory.pedra,1);assert.equal(city.economy.consumed.pedra,2);assert.ok(city.accounts.get(artist.accountId).balance>0);
});

test('an unfunded site cannot commission free urban art',()=>{
 const {city,site}=fixture();city.accounts.get(site.accountId).balance=0;assert.equal(city.gigs.createArtworkOrder(site.accountId,site.id,{kind:'painting',message:'Sem patrocínio'}),false);assert.equal(city.gigs.jobs.length,0);assert.equal(city.justice.art.length,0);
});
