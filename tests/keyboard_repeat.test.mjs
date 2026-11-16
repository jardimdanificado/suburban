import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=source.indexOf('window.addEventListener("keydown", (event) => {');
const end=source.indexOf("\nwindow.addEventListener('blur'",start);

function fixture(active=false,freeCamera=false){
  const handlers={};
  const keys=new Set(),gameEvents=[];
  const gameUI={active,key(event,down){gameEvents.push({event,down});return false;}};
  new Function('window','gameUI','mainMenu','cityUI','renderer3D','freeCameraKeys',source.slice(start,end))(
    {addEventListener(type,handler){handlers[type]=handler;}},gameUI,
    {isActive:()=>false},{key:()=>false},
    {isFirstPersonActive:()=>freeCamera,isPerspectiveActive:()=>false,followCharacterId:null},keys,
  );
  return {...handlers,keys,gameEvents};
}

function event(code,overrides={}){
  return {code,repeat:true,target:{tagName:'CANVAS'},defaultPrevented:false,
    preventDefault(){this.defaultPrevented=true;},...overrides};
}

test('held unused keys cancel native repeat in simulation and character modes',()=>{
  for(const active of [false,true])for(const code of ['KeyM','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']){
    const h=fixture(active),e=event(code);
    h.keydown(e);
    assert(e.defaultPrevented,`${active?'character':'simulation'}: ${code}`);
    if(active)assert.equal(h.gameEvents.length,1,'game controls still receive held keys');
  }
});

test('text entry and browser shortcuts keep native repeat',()=>{
  for(const active of [false,true])for(const overrides of [
    {target:{tagName:'INPUT'}},{target:{tagName:'TEXTAREA'}},{target:{tagName:'SELECT'}},
    {target:{tagName:'DIV',isContentEditable:true}},{ctrlKey:true},{metaKey:true},{altKey:true},
    {repeat:false},
  ]){
    const h=fixture(active),e=event('KeyM',overrides);
    h.keydown(e);
    assert.equal(e.defaultPrevented,false);
  }
});

test('free camera movement remains held until key release',()=>{
  const h=fixture(false,true);
  h.keydown(event('KeyW',{repeat:false}));
  h.keydown(event('KeyW'));
  assert(h.keys.has('KeyW'));
  h.keyup(event('KeyW',{repeat:false}));
  assert.equal(h.keys.size,0);
});
