import test from 'node:test';
import assert from 'node:assert/strict';
import {CITY_SYMBOLS,favoriteSymbols,symbolAffinity} from '../js/city_symbols.js';
import {COLOR_PALETTE,favoriteColors} from '../js/city_colors.js';
import {makeClothingPattern,drawPartyFlag} from '../js/city_party_flags.js';
import {
  applyPatternToGarment,
  clothingOffer,
  craftClothingPattern,
  garmentScore,
  initializeClothes,
  manufactureClothes
} from '../js/city_clothing.js';
import {CityCitizenModels} from '../js/city_citizen_models.js';

function makeRng(seed=12345){
  let s=seed>>>0;
  return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
}

function makeCity(seed=42){
  const random=makeRng(seed);
  return {
    initialSeed:seed,
    minute:2000,
    hour:8,
    random,
    nextGarmentId:0,
    economy:{
      goods:{roupas:{price:100}},
      consumed:{roupas:0},
      businesses:[],
      recordGoods(){}
    },
    currency:{price:v=>v},
    politics:{party:()=>null}
  };
}

function makeCitizen(id,seed=42){
  return {
    id,
    accountId:`citizen:${id}`,
    balance:500000,
    entity:{id,x:10,y:10,properties:{name:`Cidadão ${id}`,render:{size:1,color:0xe8e8e8}}},
    political:{},
    wardrobe:null
  };
}

function makeStore(id,type='clothing_store'){
  return {
    id,
    type,
    active:true,
    accountId:`business:${id}`,
    entity:{id:100+id,x:10,y:10,destroyed:false,properties:{name:`Loja ${id}`}},
    inventory:{roupas:0},
    garments:[],
    workers:[]
  };
}

test('makeClothingPattern uses symbols and colors with no words',()=>{
  const rng=makeRng(777);
  for(let i=0;i<20;i++){
    const pattern=makeClothingPattern({random:rng});
    assert.equal(pattern.textLayout,'sem-texto');
    assert.deepEqual(pattern.texts,[]);
    assert(pattern.emblems.length>=1&&pattern.emblems.length<=16,'pattern should have 1-16 symbols');
    assert(pattern.colors.length>=2,'pattern should have background and foreground/accent colors');
    for(const emblem of pattern.emblems)assert(CITY_SYMBOLS.includes(emblem.skin));
  }
});

test('clothing stores and tailors craft new patterns and apply them to garments',()=>{
  const city=makeCity(99);
  const tailor=makeStore(1,'tailor');
  manufactureClothes(city,tailor,40);
  const patterned=tailor.garments.filter(g=>['camisa estampada','vestido estampado'].includes(g.piece));
  assert(patterned.length>=1,'tailor should produce patterned garments');
  for(const g of patterned){
    assert(g.patternFlag,'patterned garment should have patternFlag');
    assert.equal(g.patternFlag.texts.length,0);
    assert(g.patternSymbols.length>=1);
    assert(g.patternColors.length>=2);
  }

  const store=makeStore(2,'clothing_store');
  store.garments.push({garmentId:'g-plain',piece:'camisa',style:'simples',color:'#bd4545',brandId:1,brandName:'Confecção',quality:80,condition:100,dirt:0});
  store.inventory.roupas=1;
  const created=craftClothingPattern(city,store,{applyToStock:true});
  assert(created);
  assert.equal(store.clothingPatterns.length,1);
  assert.equal(store.garments[0].piece,'camisa estampada');
  assert.equal(store.garments[0].patternFlag,created.flag);
  assert.equal(store.garments[0].patternFlag.texts.length,0);
});

test('citizens choose clothes to buy by favorite symbols and colors',()=>{
  const city=makeCity(123);
  const c=makeCitizen(7);
  initializeClothes(city,c);
  // Make sure citizen wants a better garment
  c.wardrobe=[{garmentId:'old',piece:'trapos',style:'simples',color:'#675f58',quality:10,condition:20,dirt:40}];
  c.wearingIndex=0;

  const favSym=favoriteSymbols(c)[0];
  const dislikedIdx=c.dislikedSymbols[0]??((favSym.index+10)%CITY_SYMBOLS.length);
  const dislikedSym=CITY_SYMBOLS[dislikedIdx];
  const favCol=favoriteColors(c)[0].hex;
  const neutralCol=COLOR_PALETTE.find(col=>col.hex!==favCol&&!c.dislikedColors.includes(col.hex)).hex;

  const likedPattern=makeClothingPattern(city,{preferredSymbol:favSym.skin,colors:[favCol,'#ffffff',favCol,favCol]});
  const dislikedPattern=makeClothingPattern(city,{preferredSymbol:dislikedSym,colors:[neutralCol,'#222222',neutralCol,neutralCol]});

  const store=makeStore(5,'clothing_store');
  const gDisliked={garmentId:'g-disliked',piece:'camisa estampada',style:'estampado',color:neutralCol,brandId:5,brandName:'Loja 5',quality:85,condition:100,dirt:0};
  applyPatternToGarment(gDisliked,{patternId:'p-bad',flag:dislikedPattern,symbols:[dislikedSym],colors:[neutralCol,'#222222'],background:neutralCol});
  const gLiked={garmentId:'g-liked',piece:'camisa estampada',style:'estampado',color:favCol,brandId:5,brandName:'Loja 5',quality:85,condition:100,dirt:0};
  applyPatternToGarment(gLiked,{patternId:'p-good',flag:likedPattern,symbols:[favSym.skin],colors:[favCol,'#ffffff'],background:favCol});

  store.garments=[gDisliked,gLiked];
  store.inventory.roupas=2;

  assert(symbolAffinity(c,favSym.skin)>symbolAffinity(c,dislikedSym));
  assert(garmentScore(c,gLiked)>garmentScore(c,gDisliked));
  const offer=clothingOffer(city,c,store);
  assert(offer);
  assert.equal(offer.garmentIndex,1,'citizen should choose garment with favorite symbol and colors');
});

test('CityCitizenModels resolves patternFlag material and invalidates cache on pattern change',()=>{
  const models=new CityCitizenModels({
    MeshLambertMaterial:class{constructor(opts){Object.assign(this,opts);}},
    InstancedBufferAttribute:null,
    CanvasTexture:null,
    Matrix4:class{},
    Vector3:class{},
    Quaternion:class{setFromAxisAngle(){return this;}},
    Color:class{},
    DoubleSide:2
  },{},{fetchAsset:null});
  const c=makeCitizen(12);
  const p1=makeClothingPattern({random:makeRng(1)});
  const p2=makeClothingPattern({random:makeRng(2)});
  c.wardrobe=[
    {garmentId:'g1',piece:'camisa estampada',style:'estampado',color:p1.background,patternId:'pat-1',patternFlag:p1,condition:100,dirt:0},
    {garmentId:'g2',piece:'camisa estampada',style:'estampado',color:p2.background,patternId:'pat-2',patternFlag:p2,condition:100,dirt:0}
  ];
  c.wearingIndex=0;
  const a1=models.appearanceFor(c,c.entity);
  assert.equal(a1.printed,true);
  assert.equal(a1.patterned,false);
  assert.equal(a1.patternFlagValue,p1);

  c.wearingIndex=1;
  const a2=models.appearanceFor(c,c.entity);
  assert.notEqual(a2,a1);
  assert.equal(a2.patternFlagValue,p2);
});

test('makeClothingPattern produces both repeated textile motifs and emblem prints',()=>{
  const rng=makeRng(888);
  const repeated=makeClothingPattern({random:rng},{repeated:true,tileRepeat:2});
  assert(repeated.emblems.length>=8,'repeated textile layout should place many repeated symbols');
  assert.equal(repeated.tileRepeat,2);
  assert.equal(repeated.texts.length,0);

  const emblem=makeClothingPattern({random:rng},{repeated:false,tileRepeat:1});
  assert(emblem.emblems.length>=1&&emblem.emblems.length<=4);
  assert.equal(emblem.tileRepeat,1);

  const previousDoc=globalThis.document;
  const makeCtx=()=>({
    save(){},restore(){},beginPath(){},rect(){},clip(){},
    fillRect(){},strokeRect(){},drawImage(){},
    arc(){},fill(){},moveTo(){},lineTo(){},closePath(){},translate(){},rotate(){},
    set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){},set imageSmoothingEnabled(v){}
  });
  globalThis.document={createElement:()=>({width:128,height:128,getContext:makeCtx})};
  try{
    let repeatedArgs=null;
    const models=new CityCitizenModels({
      MeshLambertMaterial:class{constructor(opts){Object.assign(this,opts);}},
      CanvasTexture:class{constructor(canvas){this.image=canvas;this.repeat={set(x,y){repeatedArgs=[x,y];}};}},
      RepeatWrapping:1000,
      ClampToEdgeWrapping:1001,
      NearestFilter:1003,
      SRGBColorSpace:'srgb',
      InstancedBufferAttribute:null,
      Matrix4:class{},
      Vector3:class{},
      Quaternion:class{setFromAxisAngle(){return this;}},
      Color:class{},
      DoubleSide:2
    },{},{fetchAsset:null});
    const mat=models.clothingPatternMaterial(repeated,false,'rep-test');
    assert.equal(mat.map.wrapS,1000);
    assert.equal(mat.map.wrapT,1000);
    assert.deepEqual(repeatedArgs,[2,2]);
  }finally{
    globalThis.document=previousDoc;
  }
});

test('drawPartyFlag supports borderless mode for clothing patterns',()=>{
  const rects=[];
  const makeCtx=()=>({
    save(){},restore(){},beginPath(){},rect(){},clip(){},
    fillRect(){},strokeRect(...args){rects.push(args);},drawImage(){},
    arc(){},fill(){},moveTo(){},lineTo(){},closePath(){},translate(){},rotate(){},
    set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){},set imageSmoothingEnabled(v){}
  });
  const previousDoc=globalThis.document;
  globalThis.document={createElement:()=>({width:8,height:8,getContext:makeCtx})};
  try{
    const pattern=makeClothingPattern({random:makeRng(55)},{backgroundStyle:'solid'});
    drawPartyFlag(makeCtx(),pattern,0,0,128,128,null,{border:false});
    assert.equal(rects.length,0,'borderless clothing pattern should not draw outer flag border');
  }finally{
    globalThis.document=previousDoc;
  }
});
