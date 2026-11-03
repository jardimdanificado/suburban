// Fictional game coefficients; all manufacturing recipes are deliberately abstract.
export const SUBSTANCES=Object.freeze({
 cafe:{label:'Café',icon:'☕',popularity:.80,addiction:.18,duration:180,happiness:3,energy:12,aggression:0,mobility:1.02,speech:1,cognition:1,lung:0,regime:'free',limit:12},
 alcool:{label:'Álcool',icon:'🍹',popularity:.64,addiction:.24,duration:150,happiness:12,energy:0,aggression:.38,mobility:.90,speech:1.25,cognition:.65,lung:0,regime:'free',limit:6},
 folha_coca:{label:'Folha de coca',icon:'🍃',popularity:.43,addiction:.08,duration:100,happiness:5,energy:7,aggression:0,mobility:1.02,speech:1,cognition:1,lung:0,regime:'regulated',limit:4},
 tabaco:{label:'Tabaco',icon:'🚬',popularity:.34,addiction:.34,duration:18,happiness:4,energy:0,aggression:0,mobility:1,speech:1,cognition:1,lung:.001,regime:'free',limit:8,smoke:true},
 cannabis:{label:'Cannabis',icon:'🌿',popularity:.20,addiction:.12,duration:180,happiness:17,energy:0,aggression:-.98,mobility:.82,speech:.95,cognition:.85,lung:.0005,regime:'regulated',limit:3,smoke:true},
 coca:{label:'Coca refinada',icon:'⚡',popularity:.025,addiction:.48,duration:90,happiness:24,energy:32,aggression:.82,mobility:1.32,speech:.22,cognition:.55,lung:.005,regime:'prohibited',limit:0},
});
export const SUBSTANCE_REGIMES={prohibited:'Proibido',regulated:'Regulamentado',free:'Livre'};
export const HEMP={label:'Cânhamo',regime:'regulated',limit:null};
export const REFINING_LEAVES=12;
export const SUBSTANCE_CROPS={
 grao_cafe:{label:'Grão de café',grow:280,price:160,nonFood:true,substance:'cafe',yieldFactor:1.5,laborFactor:1.2},
 cana:{label:'Cana para bebidas',grow:180,price:65,nonFood:true,substance:'alcool',yieldFactor:2,laborFactor:.8},
 folha_tabaco:{label:'Folha de tabaco',grow:90,price:55,nonFood:true,substance:'tabaco',yieldFactor:3,laborFactor:.6},
 flor_cannabis:{label:'Cannabis e cânhamo',grow:240,price:220,nonFood:true,substance:'canhamo',yieldFactor:1,laborFactor:1.5},
 folha_coca:{label:'Folha de coca',grow:130,price:75,nonFood:true,substance:'folha_coca',yieldFactor:2.5,laborFactor:.8},
};
export const SUBSTANCE_GOODS={...Object.fromEntries(Object.entries(SUBSTANCES).map(([id,s])=>[id,{label:id==='alcool'?'Cachaça':s.label,price:{cafe:350,alcool:650,folha_coca:75,tabaco:180,cannabis:900,coca:4200}[id]}])),cerveja:{label:'Cerveja',price:520},vinho:{label:'Vinho',price:980},canhamo:{label:'Fibra de cânhamo',price:110}};
export const SUBSTANCE_INDUSTRIES={
 coffee_roaster:['Torrefação e casa de café',{grao_cafe:4,carvao:1},{cafe:8},22,'baking','Torra e prepara café; qualidade depende do grão e do preparo.'],
 distillery:['Alambique e cachaçaria',{cana:6,carvao:1},{alcool:4},45,'baking','Fermenta e destila cana para produzir cachaça.'],
 brewery:['Cervejaria',{trigo:2,cevada:2,lupulo:1},{cerveja:6},36,'baking','Fermenta trigo e cevada com lúpulo para produzir cerveja.','food'],
 winery:['Vinícola',{uva:5},{vinho:4},38,'baking','Fermenta uvas e envelhece o vinho em lotes.','food'],
 tobacco_workshop:['Beneficiadora de fumos',{folha_tabaco:6,flor_cannabis:2,papel:1},{tabaco:12,cannabis:2},14,'baking','Beneficia, embala e vende tabaco e cannabis como produtos distintos.'],
 coca_laboratory:['Laboratório de refinamento de coca',{folha_coca:REFINING_LEAVES,carvao:2},{coca:2},120,'baking','Refinamento abstrato de alto custo; funcionamento depende da legislação.'],
 hemp_weaver:['Tecelagem de cânhamo',{canhamo:4},{fibras:4,tecido:1},22,'construction','Aproveita a fibra da planta em uma cadeia separada do consumo de cannabis.'],
};
export const SUBSTANCE_CONTROLLED_GOODS={grao_cafe:'cafe',cana:'alcool',folha_tabaco:'tabaco',flor_cannabis:'cannabis',canhamo:'canhamo',cerveja:'alcool',vinho:'alcool',...Object.fromEntries(Object.keys(SUBSTANCES).map(id=>[id,id]))};
export const ALCOHOL_DRINKS=['alcool','cerveja','vinho'];
