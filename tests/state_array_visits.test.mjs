import test from 'node:test';
import assert from 'node:assert/strict';
import {CityStateGraph} from '../js/city_state.js';

function fixture(items){
 const root={city:{world:{map:new Uint8Array(4),revision:0},citizens:[],events:[],ledger:[]},items};
 const source=new CityStateGraph(),mirror=new CityStateGraph();
 let packet=source.encode(root),copy=mirror.apply(structuredClone(packet));
 return{root,source,mirror,copy,sync(){packet=source.encode(root);mirror.apply(structuredClone(packet));return packet;}};
}

test('unchanged array references still synchronize changed children and retain reachable cycles',()=>{
 const child={value:1},items=[child];child.parent=items;const p=fixture(items);
 const arrayId=p.source.ids.get(items),childId=p.source.ids.get(child);
 child.value=2;const packet=p.sync();assert.equal(p.copy.items[0].value,2);assert.equal(p.copy.items[0].parent,p.copy.items);
 assert(!packet.nodes.some(n=>n.id===arrayId));assert(packet.nodes.some(n=>n.id===childId));
 for(let i=0;i<8;i++){const next=p.sync();assert(!next.removed.includes(childId));assert.equal(p.copy.items[0].parent,p.copy.items);}
});

test('same-length replacement and ordering remove obsolete children while preserving special numeric values',()=>{
 const a={value:'a'},b={value:'b'},items=[a,b,NaN,-0,'@literal'];const p=fixture(items),oldId=p.source.ids.get(a);
 items[0]=b;items[1]={value:'c'};items[3]=0;p.sync();assert.deepEqual(p.copy.items,items);assert(!Object.is(p.copy.items[3],-0));
 items.reverse();p.sync();assert.deepEqual(p.copy.items,items);
 const removed=[];for(let i=0;i<4;i++)removed.push(...p.sync().removed);
 assert(removed.includes(oldId));assert(!p.mirror.objects.has(oldId));
 items.length=2;p.sync();assert.deepEqual(p.copy.items,items);items.push({value:'new'});p.sync();assert.deepEqual(p.copy.items,items);
});

test('independent senders can share a frozen object without confusing identities or inherited fields',()=>{
 const proto={inherited:'not an own field'},child=Object.create(proto);child.value=1;
 const frozen=Object.freeze({text:'stable'}),p=fixture([proto,child,frozen]);
 const otherRoot={city:p.root.city,extra:{a:1,b:{c:2}},items:p.root.items},other=new CityStateGraph(),mirror=new CityStateGraph();
 const copy=mirror.apply(structuredClone(other.encode(otherRoot)));
 child.value=3;mirror.apply(structuredClone(other.encode(otherRoot)));p.sync();
 assert.equal(copy.items[1].value,3);assert.equal(p.copy.items[1].value,3);
 assert.equal(Object.hasOwn(copy.items[1],'inherited'),false);assert.notEqual(copy.items[0],copy.items[1]);
 assert.deepEqual(copy.items[2],frozen);assert.deepEqual(p.copy.items[2],frozen);
 for(let i=0;i<4;i++){other.encode(otherRoot);p.sync();}
 assert.equal(p.copy.items[1].value,3);
});
