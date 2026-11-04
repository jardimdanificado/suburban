import {ASSET_DATA} from './assets_data.js';
import {SPRITE_CLASSIFICATIONS} from './sprite_classification.js';
import {ideologicalProfile,politicalPosition} from './city_ideology.js';
import {drawPixelText} from './pixel_text.js?v=pixel-text-1';
import {gerarPaletaDeBandeira} from './paletas_bandeiras.js';

export const COUNCIL_INSTITUTIONAL_FLAG=Object.freeze({foreground:'#f5e9bf',background:'#4c655c',skin:'Feature_Flower.png',pattern:1});
const PARTY_EMBLEMS=Object.freeze(ASSET_DATA.filter(asset=>/\.png$/i.test(asset.filename)).map(asset=>asset.filename));
const imageCache=new Map(),tintedCache=new Map(),pendingImages=new Map();
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const ICON_LAYOUTS=Object.freeze({
  0:[{name:'apenas-texto',slots:[]}],
  1:[
    {name:'centro',slots:[{x:.3,y:.18,w:.4,h:.64}]},{name:'centro-amplo',slots:[{x:.2,y:.08,w:.6,h:.82}]},
    {name:'canto-superior-esquerdo',slots:[{x:.04,y:.04,w:.38,h:.54}]},{name:'canto-inferior-direito',slots:[{x:.58,y:.42,w:.38,h:.54}]},
    {name:'centro-esquerda',slots:[{x:.04,y:.22,w:.38,h:.56}]},{name:'centro-direita',slots:[{x:.58,y:.22,w:.38,h:.56}]},
    {name:'alto-central',slots:[{x:.3,y:.02,w:.4,h:.5}]},{name:'baixo-central',slots:[{x:.3,y:.48,w:.4,h:.5}]},
    {name:'motivo-horizontal-5',slots:Array.from({length:5},(_,i)=>({x:.025+i*.19,y:.32,w:.14,h:.36,repeatGroup:'motivo',detailGroup:'motivo'}))},
    {name:'motivo-horizontal-7',slots:Array.from({length:7},(_,i)=>({x:.015+i*.14,y:.34,w:.11,h:.32,repeatGroup:'motivo',detailGroup:'motivo'}))},
    {name:'motivo-horizontal-9',slots:Array.from({length:9},(_,i)=>({x:.015+i*.108,y:.36,w:.08,h:.28,repeatGroup:'motivo',detailGroup:'motivo'}))},
    {name:'motivo-vertical-5',slots:Array.from({length:5},(_,i)=>({x:.4,y:.02+i*.19,w:.2,h:.15,repeatGroup:'motivo',detailGroup:'motivo'}))},
    {name:'motivo-diagonal-5',slots:Array.from({length:5},(_,i)=>({x:.025+i*.19,y:.04+i*.14,w:.15,h:.34,repeatGroup:'motivo',detailGroup:'motivo'}))},
    {name:'motivo-circular-6',slots:Array.from({length:6},(_,i)=>{const a=-Math.PI/2+i*Math.PI/3;return{x:.5+Math.cos(a)*.31-.07,y:.5+Math.sin(a)*.34-.15,w:.14,h:.3,repeatGroup:'motivo',detailGroup:'motivo'};})}
  ],
  2:[
    {name:'horizontal',slots:[{x:.03,y:.16,w:.43,h:.68},{x:.54,y:.16,w:.43,h:.68}]},{name:'vertical',slots:[{x:.22,y:.02,w:.56,h:.43},{x:.22,y:.55,w:.56,h:.43}]},
    {name:'diagonal-descendente',slots:[{x:.02,y:.02,w:.42,h:.58},{x:.56,y:.4,w:.42,h:.58}]},{name:'diagonal-ascendente',slots:[{x:.56,y:.02,w:.42,h:.58},{x:.02,y:.4,w:.42,h:.58}]},
    {name:'duas-faixas-laterais',slots:[{x:.02,y:.22,w:.3,h:.56},{x:.68,y:.22,w:.3,h:.56}]},{name:'duas-colunas',slots:[{x:.19,y:.04,w:.28,h:.92},{x:.53,y:.04,w:.28,h:.92}]},
    {name:'cantos-opostos',slots:[{x:.03,y:.03,w:.35,h:.48},{x:.62,y:.49,w:.35,h:.48}]},{name:'topo-e-base',slots:[{x:.32,y:.02,w:.36,h:.36},{x:.32,y:.62,w:.36,h:.36}]},
    {name:'faixa-horizontal-centralizada',slots:[{x:.03,y:.08,w:.44,h:.84},{x:.53,y:.08,w:.44,h:.84}]},
    {name:'composicao-metades-verticais',slots:[{x:.08,y:.14,w:.84,h:.72,clip:{x:.08,y:.08,w:.42,h:.84},detailGroup:'composicao'},{x:.08,y:.14,w:.84,h:.72,clip:{x:.5,y:.08,w:.42,h:.84},detailGroup:'composicao'}]},
    {name:'composicao-metades-horizontais',slots:[{x:.08,y:.14,w:.84,h:.72,clip:{x:.08,y:.08,w:.84,h:.42},detailGroup:'composicao'},{x:.08,y:.14,w:.84,h:.72,clip:{x:.08,y:.5,w:.84,h:.42},detailGroup:'composicao'}]}
  ],
  3:[
    {name:'triangulo',slots:[{x:.34,y:.02,w:.32,h:.45},{x:.02,y:.52,w:.42,h:.46},{x:.56,y:.52,w:.42,h:.46}]},{name:'linha-tripla',slots:[{x:.02,y:.2,w:.3,h:.6},{x:.35,y:.2,w:.3,h:.6},{x:.68,y:.2,w:.3,h:.6}]},
    {name:'coluna-tripla',slots:[{x:.3,y:.01,w:.4,h:.29},{x:.3,y:.355,w:.4,h:.29},{x:.3,y:.7,w:.4,h:.29}]},{name:'tres-cantos',slots:[{x:.02,y:.02,w:.36,h:.47},{x:.62,y:.02,w:.36,h:.47},{x:.32,y:.52,w:.36,h:.46}]},
    {name:'lado-centro-lado',slots:[{x:.02,y:.3,w:.3,h:.4},{x:.35,y:.15,w:.3,h:.7},{x:.68,y:.3,w:.3,h:.4}]},{name:'degrau',slots:[{x:.02,y:.54,w:.3,h:.44},{x:.35,y:.28,w:.3,h:.44},{x:.68,y:.02,w:.3,h:.44}]},
    {name:'duas-em-cima-uma-embaixo',slots:[{x:.08,y:.02,w:.38,h:.46},{x:.54,y:.02,w:.38,h:.46},{x:.31,y:.52,w:.38,h:.46}]},{name:'uma-em-cima-duas-embaixo',slots:[{x:.31,y:.02,w:.38,h:.46},{x:.08,y:.52,w:.38,h:.46},{x:.54,y:.52,w:.38,h:.46}]},
    {name:'faixa-tripla-centralizada',slots:[{x:.02,y:.16,w:.3,h:.68},{x:.35,y:.16,w:.3,h:.68},{x:.68,y:.16,w:.3,h:.68}]}
  ],
  4:[
    {name:'quadrantes',slots:[{x:0,y:0,w:.5,h:.5},{x:.5,y:0,w:.5,h:.5},{x:0,y:.5,w:.5,h:.5},{x:.5,y:.5,w:.5,h:.5}]},
    {name:'quatro-cantos',slots:[{x:.02,y:.02,w:.38,h:.43},{x:.6,y:.02,w:.38,h:.43},{x:.02,y:.55,w:.38,h:.43},{x:.6,y:.55,w:.38,h:.43}]},
    {name:'losango',slots:[{x:.34,y:.01,w:.32,h:.28},{x:.02,y:.36,w:.3,h:.28},{x:.68,y:.36,w:.3,h:.28},{x:.34,y:.71,w:.32,h:.28}]},
    {name:'linha-de-quatro',slots:[{x:.01,y:.28,w:.23,h:.44},{x:.26,y:.28,w:.23,h:.44},{x:.51,y:.28,w:.23,h:.44},{x:.76,y:.28,w:.23,h:.44}]},
    {name:'coluna-de-quatro',slots:[{x:.27,y:.01,w:.46,h:.23},{x:.27,y:.26,w:.46,h:.23},{x:.27,y:.51,w:.46,h:.23},{x:.27,y:.76,w:.46,h:.23}]},
    {name:'faixa-de-quatro-centralizada',slots:[{x:.01,y:.24,w:.23,h:.52},{x:.26,y:.24,w:.23,h:.52},{x:.51,y:.24,w:.23,h:.52},{x:.76,y:.24,w:.23,h:.52}]},
    {name:'grade-aberta',slots:[{x:.04,y:.03,w:.38,h:.38},{x:.58,y:.03,w:.38,h:.38},{x:.04,y:.59,w:.38,h:.38},{x:.58,y:.59,w:.38,h:.38}]},
    {name:'anel-quadrado',slots:[{x:.02,y:.02,w:.3,h:.38},{x:.68,y:.02,w:.3,h:.38},{x:.02,y:.6,w:.3,h:.38},{x:.68,y:.6,w:.3,h:.38}]},
    {name:'mosaico-de-quartos',slots:[{x:0,y:0,w:.5,h:.5,crop:{x:0,y:0,w:.5,h:.5}},{x:.5,y:0,w:.5,h:.5,crop:{x:.5,y:0,w:.5,h:.5}},{x:0,y:.5,w:.5,h:.5,crop:{x:0,y:.5,w:.5,h:.5}},{x:.5,y:.5,w:.5,h:.5,crop:{x:.5,y:.5,w:.5,h:.5}}]}
  ]
});
const TEXT_LAYOUTS=Object.freeze([
  {id:'sem-texto',boxes:[],area:{x:.035,y:.035,w:.93,h:.93}},
  {id:'frase-em-cima',boxes:[{x:.04,y:.015,w:.92,h:.09,kind:'phrase'}],area:{x:.035,y:.15,w:.93,h:.78}},
  {id:'frase-embaixo',boxes:[{x:.04,y:.895,w:.92,h:.09,kind:'phrase'}],area:{x:.035,y:.04,w:.93,h:.8}},
  {id:'frase-na-lateral-esquerda',boxes:[{x:.015,y:.08,w:.16,h:.84,rotation:-Math.PI/2,kind:'word'}],area:{x:.22,y:.035,w:.74,h:.93}},
  {id:'frase-na-lateral-direita',boxes:[{x:.825,y:.08,w:.16,h:.84,rotation:Math.PI/2,kind:'word'}],area:{x:.04,y:.035,w:.74,h:.93}},
  {id:'frase-em-cima-numero-embaixo',boxes:[{x:.04,y:.015,w:.92,h:.09,kind:'phrase'},{x:.04,y:.895,w:.92,h:.09,kind:'number'}],area:{x:.04,y:.15,w:.92,h:.7}},
  {id:'texto-nas-duas-laterais',boxes:[{x:.01,y:.12,w:.15,h:.76,rotation:-Math.PI/2,kind:'word'},{x:.84,y:.12,w:.15,h:.76,rotation:Math.PI/2,kind:'number'}],area:{x:.2,y:.04,w:.6,h:.92}},
  {id:'nome-e-numero-em-faixas',boxes:[{x:.04,y:.015,w:.92,h:.09,kind:'name'},{x:.04,y:.895,w:.92,h:.09,kind:'number'}],area:{x:.04,y:.15,w:.92,h:.7}},
  {id:'somente-numero',boxes:[{x:.04,y:.015,w:.92,h:.09,kind:'number'}],area:{x:.04,y:.15,w:.92,h:.78}},
  {id:'somente-nome',boxes:[{x:.04,y:.015,w:.92,h:.09,kind:'name'}],area:{x:.04,y:.15,w:.92,h:.78}},
  {id:'nome-e-numero',boxes:[{x:.04,y:.015,w:.92,h:.09,kind:'name'},{x:.04,y:.895,w:.92,h:.09,kind:'number'}],area:{x:.04,y:.15,w:.92,h:.7}},
  {id:'nome-com-fundo',boxes:[{x:.04,y:.015,w:.92,h:.09,kind:'name'}],area:{x:.04,y:.15,w:.92,h:.78}},
  {id:'numero-com-fundo',boxes:[{x:.04,y:.015,w:.92,h:.09,kind:'number'}],area:{x:.04,y:.15,w:.92,h:.78}},
  {id:'nome-numero-com-fundo',boxes:[{x:.04,y:.015,w:.92,h:.09,kind:'name'},{x:.04,y:.895,w:.92,h:.09,kind:'number'}],area:{x:.04,y:.15,w:.92,h:.7}},
  {id:'slogan-em-faixa-central',boxes:[{x:.08,y:.43,w:.84,h:.14,kind:'phrase'}],area:{x:.05,y:.04,w:.9,h:.34}},
  {id:'nome-em-faixa-central',boxes:[{x:.08,y:.43,w:.84,h:.14,kind:'name'}],area:{x:.05,y:.04,w:.9,h:.34}},
  {id:'numero-em-faixa-central',boxes:[{x:.2,y:.42,w:.6,h:.16,kind:'number'}],area:{x:.05,y:.04,w:.9,h:.34}},
  {id:'nome-a-direita-do-simbolo',boxes:[{x:.68,y:.28,w:.29,h:.44,kind:'name'}],area:{x:.03,y:.12,w:.59,h:.76}},
  {id:'nome-a-esquerda-do-simbolo',boxes:[{x:.03,y:.28,w:.29,h:.44,kind:'name'}],area:{x:.38,y:.12,w:.59,h:.76}},
  {id:'nome-numero-lado-a-lado-acima',boxes:[{x:.03,y:.015,w:.58,h:.09,kind:'name'},{x:.65,y:.015,w:.32,h:.09,kind:'number'}],area:{x:.04,y:.15,w:.92,h:.76}},
  {id:'nome-numero-lado-a-lado-abaixo',boxes:[{x:.03,y:.895,w:.58,h:.09,kind:'name'},{x:.65,y:.895,w:.32,h:.09,kind:'number'}],area:{x:.04,y:.04,w:.92,h:.76}},
  {id:'nome-superior-numero-inferior-cantos',boxes:[{x:.04,y:.015,w:.42,h:.09,kind:'name'},{x:.54,y:.895,w:.42,h:.09,kind:'number'}],area:{x:.08,y:.15,w:.84,h:.7}},
  {id:'slogan-superior-nome-inferior',boxes:[{x:.04,y:.015,w:.92,h:.09,kind:'phrase'},{x:.04,y:.895,w:.92,h:.09,kind:'name'}],area:{x:.04,y:.15,w:.92,h:.7}},
  {id:'nome-e-numero-em-faixa-central',boxes:[{x:.04,y:.43,w:.61,h:.14,kind:'name'},{x:.68,y:.43,w:.28,h:.14,kind:'number'}],area:{x:.04,y:.04,w:.92,h:.34}},
  {id:'palavra-em-canto-superior',boxes:[{x:.62,y:.025,w:.34,h:.1,kind:'word'}],area:{x:.04,y:.15,w:.92,h:.78}}
]);
const TEXT_ONLY_LAYOUT_IDS=new Set(['somente-numero','somente-nome','nome-e-numero','nome-com-fundo','numero-com-fundo','nome-numero-com-fundo','slogan-em-faixa-central','nome-em-faixa-central','numero-em-faixa-central','nome-a-direita-do-simbolo','nome-a-esquerda-do-simbolo','nome-numero-lado-a-lado-acima','nome-numero-lado-a-lado-abaixo','nome-superior-numero-inferior-cantos','slogan-superior-nome-inferior','nome-e-numero-em-faixa-central','palavra-em-canto-superior']);
export const PARTY_FLAG_BACKGROUNDS=Object.freeze([
 'solid','stripes-horizontal','stripes-horizontal-2','stripes-horizontal-3','stripes-horizontal-4','stripes-horizontal-6',
 'stripes-vertical','stripes-vertical-2','stripes-vertical-3','stripes-vertical-4','stripes-vertical-6',
 'stripes-diagonal','stripes-diagonal-2','stripes-diagonal-3','stripes-diagonal-4','stripes-diagonal-6','stripes-diagonal-reverse-3','stripes-diagonal-reverse-5',
 'quartered','checkerboard-2','checkerboard-3','checkerboard-4','plaid','grid',
 'canton-top-left','canton-top-right','canton-bottom-left','canton-bottom-right',
 'circle','double-circle','circle-small','circle-large','circle-left','circle-right','circle-top','circle-bottom','triple-circles-horizontal','triple-circles-vertical',
 'sun-disc-left','sunrise','sunburst',
 'diamond','diamond-left','diamond-right','diamonds-2','lozengy',
 'star','stars-2','stars-3','stars-5','star-canton',
 'cross','nordic-cross-left','nordic-cross-right','double-cross','saltire','cross-diagonal',
 'chevron','chevron-right','chevrons-2','chevrons-3',
 'border','double-border','top-bottom-border','side-borders','top-bar','bottom-bar',
 'triangle-left','triangle-right','triangle-top','triangle-bottom','triangles-4',
 'wave-horizontal','wave-vertical','wave-double','wave-diagonal','dots-small','dots-large',
 'fess-top','fess-bottom','pale-left','pale-center','pale-right',
 'bicolor-diagonal','bicolor-diagonal-reverse','diagonal-band','diagonal-band-reverse','diagonal-band-double',
 'triangle-hoist','triangle-fly','triangle-top-wide','triangle-bottom-wide','pile-left','pile-right','pile-top','pile-bottom',
 'chevron-band','chevron-band-reverse','pall','pall-inverted','gyronny-4','gyronny-6','gyronny-8','saltire-quartered',
 'cross-fimbriated','cross-offset','nordic-cross-centered','nordic-cross-double','cross-canton','cross-four-cantons',
 'canton-diagonal','canton-cross','canton-star','canton-circle','canton-double','canton-striped',
 'fess-narrow','fess-wide','fess-double','chief','base-stripe','pale-wide-left','pale-wide-center','pale-wide-right','pale-double',
 'bordure','bordure-double','bordure-canton','central-disc-ring','crescent-left','crescent-right','crescent-center',
 'crescent-star-left','crescent-star-right','sunburst-canton','sunburst-left','lozengy-diagonal','checkerboard-6',
 'wave-band','wave-band-double','sawtooth-top','sawtooth-bottom','sawtooth-left','sawtooth-right','serrated-hoist','serrated-fly',
 'quartered-cross','diagonal-quarter','diagonal-quarter-reverse','central-frame','central-medallion','hoist-stripe','fly-stripe'
]);
const inside=(a,b)=>a.x>=b.x-1e-6&&a.y>=b.y-1e-6&&a.x+a.w<=b.x+b.w+1e-6&&a.y+a.h<=b.y+b.h+1e-6;
function patternContainsRect(style,rect,aspect){
 const bands=[{x:0,y:0,w:1,h:.2},{x:0,y:.4,w:1,h:.2},{x:0,y:.8,w:1,h:.2}];
 if(style==='solid')return false;
 if(style==='stripes-horizontal')return bands.some(band=>inside(rect,band));
 if(style==='stripes-vertical')return bands.some(band=>inside(rect,{x:band.y,y:0,w:band.h,h:1}));
 if(style==='quartered')return [{x:0,y:0,w:.5,h:.5},{x:.5,y:.5,w:.5,h:.5}].some(box=>inside(rect,box));
 if(!['circle','double-circle','diamond','cross'].includes(style))return false;
 const points=[[rect.x,rect.y],[rect.x+rect.w,rect.y],[rect.x,rect.y+rect.h],[rect.x+rect.w,rect.y+rect.h]];
 if(style==='cross')return inside(rect,{x:.44,y:.16,w:.12,h:.68})||inside(rect,{x:.08,y:.45,w:.84,h:.1});
 if(style==='diamond')return points.every(([x,y])=>Math.abs(x-.5)/.32+Math.abs(y-.5)/.34<=1+1e-6);
 const fx=aspect>1?aspect:1,fy=aspect>1?1:1/aspect,r=style==='circle'?.31:.36;
 const insideCircle=points.every(([x,y])=>((x-.5)*fx)**2+((y-.5)*fy)**2<=r*r+1e-6);
 if(!insideCircle)return false;
 if(style==='double-circle'){
  const nearestX=clamp(.5,rect.x,rect.x+rect.w),nearestY=clamp(.5,rect.y,rect.y+rect.h);
  if(((nearestX-.5)*fx)**2+((nearestY-.5)*fy)**2<.19**2-1e-6)return false;
 }
 return true;
}
function textLayoutCompatible(layout,style,aspect){
 if(!layout.boxes.length)return true;
 return layout.boxes.every(box=>{
  const width=box.rotation?box.h:box.w,height=box.rotation?box.w:box.h;
  return box.x>=0&&box.y>=0&&box.x+box.w<=1&&box.y+box.h<=1&&width>.04&&height<=.2;
 });
}
export const PARTY_FLAG_LAYOUTS=Object.freeze(Object.entries(ICON_LAYOUTS).flatMap(([count,arrangements])=>arrangements.flatMap(arrangement=>TEXT_LAYOUTS.map(textLayout=>Object.freeze({id:`${count}-${arrangement.name}-${textLayout.id}`,count:Number(count),arrangement:arrangement.name,textLayout:textLayout.id,slots:Object.freeze(arrangement.slots.map(slot=>Object.freeze({...slot}))),iconArea:Object.freeze({...textLayout.area}),textBoxes:Object.freeze(textLayout.boxes.map(box=>Object.freeze({...box})))})))));

export function flagContrast(a,b){
 const luminance=hex=>{const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;},x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
function randomColor(hue,lightness,saturation){
 const l=lightness,a=saturation*Math.min(l,1-l),f=n=>{const k=(n+hue/30)%12;return l-a*Math.max(-1,Math.min(k-3,9-k,1));};
 return `#${[f(0),f(8),f(4)].map(value=>Math.round(value*255).toString(16).padStart(2,'0')).join('')}`;
}
function weightedSprite(city,party,used){
 const profile=party?.ideology?ideologicalProfile(party):{economy:0,liberty:0,green:.4},economy=clamp(profile.economy||0,-1,1),liberty=clamp(profile.liberty||0,-1,1),green=clamp(profile.green??.4,0,1),greenAxis=green*2-1;
 const candidates=PARTY_EMBLEMS.filter(filename=>!used.has(filename));let total=0;const weights=candidates.map(filename=>{
  const affinity=SPRITE_CLASSIFICATIONS[filename]?.politicalAffinity||{economy:0,liberty:0,green:0};
  const alignment=economy*affinity.economy*.42+liberty*affinity.liberty*.28+greenAxis*affinity.green*.3;
  // Every asset remains selectable; the party's three ideological axes only
  // increase the odds of a symbol whose subject matter fits that profile.
  const weight=1.05+Math.max(-.3,alignment)*1.35;total+=weight;return weight;
 });
 let pick=city.random()*total;for(let i=0;i<candidates.length;i++){pick-=weights[i];if(pick<=0)return candidates[i];}return candidates.at(-1)||'Feature_Flower.png';
}
const SLOGAN_STOP_WORDS=new Set(['a','as','o','os','um','uma','uns','umas','de','da','do','das','dos','em','no','na','nos','nas','por','para','com','sem','e','ou','mas','que','se','ao','aos','à','às','como','mais','menos','todo','toda','todos','todas','seu','sua','seus','suas','nosso','nossa','nossos','nossas']);
export function compactPartySlogan(slogan){
 const words=String(slogan||'').match(/[A-Za-zÀ-ÿ0-9]+(?:['’-][A-Za-zÀ-ÿ0-9]+)*/g)||[];if(words.length<=6)return String(slogan||'');
 const keywords=words.filter(word=>word.length>=4&&!SLOGAN_STOP_WORDS.has(word.toLocaleLowerCase('pt-BR'))),selected=keywords.slice(0,3);for(const word of words)if(selected.length<3&&!selected.includes(word))selected.push(word);
 return selected.slice(0,3).join(' ');
}
function chooseText(city,party,kind){
 const source=String(party?.slogan||party?.short||party?.name||'');
 if(kind==='number')return party?.number==null?String(party?.short||''):String(party.number);
 if(kind==='name')return String(party?.short||party?.name||'');
 if(kind==='word'){const words=source.split(/\s+/).filter(word=>word.length>2);return words.length?words[Math.floor(city.random()*words.length)]:String(party?.short||party?.name||'');}
 if(kind==='name-number')return `${party?.short||party?.name||''} ${party?.number??''}`.trim();
 if(kind==='phrase')return party?.id!=null||party?.municipal?compactPartySlogan(source):source;
 const kinds=['word','phrase','name','number','name-number'];return chooseText(city,party,kinds[Math.floor(city.random()*kinds.length)]);
}
function buildTexts(city,party,boxes,palette){return Object.freeze(boxes.map(box=>Object.freeze({...box,value:chooseText(city,party,box.kind),color:palette[2]||palette[1]})).filter(text=>text.value));}
function layoutEmblems(city,party,layout,palette){
 const used=new Set(),detailModes=new Map(),repeatSkins=new Map();return Object.freeze(layout.slots.map((slot,index)=>{
  let skin;if(slot.repeatGroup&&repeatSkins.has(slot.repeatGroup))skin=repeatSkins.get(slot.repeatGroup);else{skin=weightedSprite(city,party,used);used.add(skin);if(slot.repeatGroup)repeatSkins.set(slot.repeatGroup,skin);}const area=layout.iconArea;
  const color=palette[3]||palette[1],shade=color,detailGroup=slot.detailGroup??index;if(!detailModes.has(detailGroup))detailModes.set(detailGroup,city.random()<.8?'detailed':'flat');
  return Object.freeze({skin,x:area.x+slot.x*area.w,y:area.y+slot.y*area.h,w:slot.w*area.w,h:slot.h*area.h,...(slot.crop?{crop:Object.freeze({...slot.crop})}:{}),...(slot.clip?{clip:Object.freeze({x:area.x+slot.clip.x*area.w,y:area.y+slot.clip.y*area.h,w:slot.clip.w*area.w,h:slot.clip.h*area.h})}:{}),color,shade,detailMode:detailModes.get(detailGroup),backgroundMode:city.random()<.07?'tile':'transparent'});
 }));
}
function flagPalette(city,hue,background,foreground){
 const colors=[background,foreground];
 const addAccent=()=>{
  let best=null,bestScore=-1;
  for(let attempt=0;attempt<64;attempt++){
   const accent=randomColor(city.random()*360,.24+city.random()*.58,.55+city.random()*.42);if(colors.includes(accent))continue;
   const score=Math.min(...colors.map(color=>flagContrast(accent,color)));if(score>bestScore){best=accent;bestScore=score;}if(score>=1.8)break;
  }
  if(best)colors.push(best);
 };
 // Keep separate swatches for the field, pattern, lettering, and emblems.
 addAccent();addAccent();
 return Object.freeze(colors);
}
function choosePartyPalette(city,legacyPalette){
 if(city.random()<.02){const palette=legacyPalette();return {...palette,colorSource:palette.colorSource||'legacy'};}
 const generated=gerarPaletaDeBandeira({random:()=>city.random()}),background=generated.cores[0];let foreground=generated.cores[1];
 if(flagContrast(foreground,background)<4.5)foreground=flagContrast('#ffffff',background)>=flagContrast('#111111',background)?'#ffffff':'#111111';
 const colors=Object.freeze([background,foreground,...generated.cores.slice(2)]);
 return {background,foreground,colors,colorSource:'palette-generator'};
}
function arrangementPreferences(style,count){
 if(!count)return [];
 if(/canton|sunburst-canton/.test(style))return count===1?['canto-superior-esquerdo','alto-central','centro-esquerda']:count===2?['horizontal','cantos-opostos','duas-colunas']:count===3?['duas-em-cima-uma-embaixo','tres-cantos']:['quatro-cantos','quadrantes','grade-aberta'];
 if(style==='crescent-star-left'||style==='crescent-left')return count===1?['canto-superior-esquerdo','centro-esquerda','motivo-circular-6']:count===2?['horizontal','cantos-opostos']:count===3?['triangulo','tres-cantos']:['quatro-cantos','quadrantes'];
 if(style==='crescent-star-right'||style==='crescent-right')return count===1?['canto-inferior-direito','centro-direita','motivo-circular-6']:count===2?['horizontal','cantos-opostos']:count===3?['triangulo','tres-cantos']:['quatro-cantos','quadrantes'];
 if(/triangle-top|pile-top|sawtooth-top|chief/.test(style))return count===1?['baixo-central','canto-inferior-direito','centro']:count===2?['topo-e-base','horizontal','diagonal-descendente']:count===3?['linha-tripla','duas-em-cima-uma-embaixo']:['linha-de-quatro','quadrantes'];
 if(/triangle-bottom|pile-bottom|sawtooth-bottom|base-stripe/.test(style))return count===1?['alto-central','canto-superior-esquerdo','centro']:count===2?['topo-e-base','horizontal','diagonal-ascendente']:count===3?['linha-tripla','uma-em-cima-duas-embaixo']:['linha-de-quatro','quadrantes'];
 if(style==='sun-disc-left'||style==='sunburst-left')return count===1?['centro-direita','canto-inferior-direito','baixo-central']:count===2?['horizontal','cantos-opostos']:count===3?['triangulo','tres-cantos']:['quatro-cantos','quadrantes'];
 if(/triangle-hoist|triangle-left|pile-left|chevron-band-reverse|chevron$/.test(style))return count===1?['centro-direita','canto-inferior-direito','baixo-central']:count===2?['horizontal','cantos-opostos','diagonal-descendente']:count===3?['triangulo','duas-em-cima-uma-embaixo']:['quatro-cantos','losango'];
 if(/triangle-fly|triangle-right|pile-right|chevron-band$|chevron-right/.test(style))return count===1?['centro-esquerda','canto-superior-esquerdo','baixo-central']:count===2?['horizontal','cantos-opostos','diagonal-ascendente']:count===3?['triangulo','uma-em-cima-duas-embaixo']:['quatro-cantos','losango'];
 if(/nordic-cross|cross-offset/.test(style))return count===1?['centro-direita','centro','canto-inferior-direito']:count===2?['horizontal','cantos-opostos']:count===3?['linha-tripla','lado-centro-lado']:['quatro-cantos','linha-de-quatro'];
 if(/circle|disc|sun|diamond|saltire|cross|star|crescent|medallion|pall|gyronny|diagonal-band|bicolor-diagonal/.test(style))return count===1?['centro','centro-amplo','alto-central']:count===2?['horizontal','vertical','cantos-opostos']:count===3?['triangulo','linha-tripla','tres-cantos']:['quadrantes','quatro-cantos','anel-quadrado'];
 if(/stripes|fess|pale|wave|border|bordure/.test(style))return count===1?['centro','centro-amplo','motivo-horizontal-5']:count===2?['horizontal','duas-faixas-laterais','topo-e-base']:count===3?['linha-tripla','coluna-tripla','triangulo']:['linha-de-quatro','quadrantes','grade-aberta'];
 return [];
}
function chooseFlagArrangement(city,arrangements,style,count){
 const preferred=new Set(arrangementPreferences(style,count)),matches=arrangements.filter(arrangement=>preferred.has(arrangement.name)),pool=matches.length&&city.random()<.78?matches:arrangements;
 return pool[Math.floor(city.random()*pool.length)];
}
export function makePartyFlag(city,index,founders=[],party=null){
 const palette=choosePartyPalette(city,()=>{const hue=city.random()*360,background=randomColor(hue,.19,.78);let foreground=randomColor((hue+180)%360,.88,.58);if(flagContrast(foreground,background)<4.5)foreground=flagContrast('#ffffff',background)>=flagContrast('#111111',background)?'#ffffff':'#111111';return {background,foreground,colors:flagPalette(city,hue,background,foreground),colorSource:'legacy'};}),{background,foreground,colors}=palette,count=city.random()<.15?0:1+Math.floor(city.random()*4),arrangements=ICON_LAYOUTS[count],aspect=120/76,backgroundChoices=[...Array(51).fill('solid'),...PARTY_FLAG_BACKGROUNDS.filter(style=>style!=='solid')];let backgroundStyle=backgroundChoices[Math.floor(city.random()*backgroundChoices.length)];const arrangement=chooseFlagArrangement(city,arrangements,backgroundStyle,count);
 const textChoices=count===0?TEXT_LAYOUTS.filter(item=>TEXT_ONLY_LAYOUT_IDS.has(item.id)):TEXT_LAYOUTS.filter(item=>!TEXT_ONLY_LAYOUT_IDS.has(item.id)),compatibleLayouts=textChoices.filter(item=>textLayoutCompatible(item,backgroundStyle,aspect)),textLayout=compatibleLayouts[Math.floor(city.random()*compatibleLayouts.length)]||textChoices[0];
 if(count===0&&textLayout.id.endsWith('-com-fundo')&&backgroundStyle==='solid')backgroundStyle=PARTY_FLAG_BACKGROUNDS.filter(style=>style!=='solid')[Math.floor(city.random()*(PARTY_FLAG_BACKGROUNDS.length-1))];
 const layout=PARTY_FLAG_LAYOUTS.find(item=>item.id===`${count}-${arrangement.name}-${textLayout.id}`),emblems=layoutEmblems(city,party,layout,colors),texts=buildTexts(city,party,layout.textBoxes,colors);
 return Object.freeze({foreground,background,colors,paletteVersion:3,detailVersion:1,pattern:Math.floor(city.random()*3),backgroundStyle,layoutId:layout.id,layoutName:arrangement.name,textLayout:layout.textLayout,colorSource:palette.colorSource,emblems,texts,politicalPosition:party?.ideology?politicalPosition(ideologicalProfile(party).economy):null});
}
export function makeMunicipalFlag(city,identity={}){
 const name=String(identity.name||'Cidade'),subject={name,short:name,slogan:String(identity.slogan||''),number:null,municipal:true};let flag;
 // Give the city's flag the same palette and layout generator as party flags,
 // while avoiding the rare text-only, plain-field combination for its default.
 for(let attempt=0;attempt<48;attempt++){flag=makePartyFlag(city,-1,[],subject);if(flag.emblems.length&&flag.backgroundStyle!=='solid')return flag;}
 return flag;
}
function remapMunicipalFlag(city,flag,emblems,texts,identity){
 const count=emblems.length,textCount=texts.length,oldTextLayout=flag.textLayout,layouts=PARTY_FLAG_LAYOUTS.filter(layout=>layout.count===count),matching=layouts.filter(layout=>layout.textLayout===oldTextLayout&&layout.textBoxes.length===textCount),pool=matching.length?matching:layouts.filter(layout=>layout.textBoxes.length===textCount),chosen=pool.length?pool[Math.floor(city.random()*pool.length)]:layouts[Math.floor(city.random()*layouts.length)];
 if(!chosen)return flag;
 const area=chosen.iconArea,placed=Object.freeze(chosen.slots.map((slot,index)=>Object.freeze({...emblems[index],x:area.x+slot.x*area.w,y:area.y+slot.y*area.h,w:slot.w*area.w,h:slot.h*area.h,...(slot.clip?{clip:Object.freeze({x:area.x+slot.clip.x*area.w,y:area.y+slot.clip.y*area.h,w:slot.clip.w*area.w,h:slot.clip.h*area.h})}:{clip:undefined})}))),placedTexts=Object.freeze(chosen.textBoxes.map((box,index)=>Object.freeze({...texts[index],...box,color:texts[index]?.color||flag.colors?.[2]||flag.foreground})));
 return Object.freeze({...flag,layoutId:chosen.id,layoutName:chosen.arrangement,textLayout:chosen.textLayout,emblems:placed,texts:placedTexts,municipalName:identity.name,municipalSlogan:identity.slogan});
}
export function mutateMunicipalFlag(city,flag,operation,identity={}){
 if(!flag)return makeMunicipalFlag(city,identity);
 const emblems=(flag.emblems||[]).map(emblem=>({...emblem})),texts=(flag.texts||[]).map(text=>({...text}));
 if(operation.type==='background'&&PARTY_FLAG_BACKGROUNDS.includes(operation.value))return Object.freeze({...flag,backgroundStyle:operation.value});
 if(operation.type==='color'&&Number.isInteger(operation.index)&&operation.index>=0&&operation.index<=3&&/^#[\da-f]{6}$/i.test(operation.value||'')){
  const colors=[...(flag.colors||[flag.background,flag.foreground,flag.foreground,flag.foreground])];while(colors.length<4)colors.push(colors.at(-1)||flag.foreground);colors[operation.index]=operation.value.toLowerCase();
  if(operation.index===0){const candidates=[...colors,'#f5e9bf','#17244b'];colors[1]=flagContrast(colors[1],colors[0])>=3?colors[1]:strongestFlagColor(candidates,[colors[0]],[colors[0]],'#f5e9bf');colors[2]=flagContrast(colors[2],colors[0])>=3&&flagContrast(colors[2],colors[1])>=2?colors[2]:strongestFlagColor(candidates,[colors[0],colors[1]],[colors[0],colors[1]],colors[1]==='#17244b'?'#f5e9bf':'#17244b');colors[3]=flagContrast(colors[3],colors[0])>=3&&flagContrast(colors[3],colors[1])>=2&&flagContrast(colors[3],colors[2])>=2?colors[3]:strongestFlagColor(candidates,[colors[0],colors[1],colors[2]],[colors[0],colors[1],colors[2]],'#f5e9bf');return Object.freeze({...flag,background:colors[0],foreground:colors[1],colors:Object.freeze(colors),emblems:Object.freeze(emblems.map(row=>Object.freeze({...row,color:colors[3],shade:colors[3]}))),texts:Object.freeze(texts.map(row=>Object.freeze({...row,color:colors[2]})))});}
  if(operation.index===1)return Object.freeze({...flag,foreground:colors[1],colors:Object.freeze(colors)});
  if(operation.index===2)return Object.freeze({...flag,colors:Object.freeze(colors),texts:Object.freeze(texts.map(row=>Object.freeze({...row,color:colors[2]})))});
  return Object.freeze({...flag,colors:Object.freeze(colors),emblems:Object.freeze(emblems.map(row=>Object.freeze({...row,color:colors[3],shade:colors[3]})))});
 }
 if(operation.type==='add-symbol'&&emblems.length<4){const skin=weightedSprite(city,null,new Set(emblems.map(emblem=>emblem.skin))),color=flag.colors?.[3]||flag.foreground;emblems.push({skin,color,shade:color,detailMode:city.random()<.8?'detailed':'flat',backgroundMode:'transparent'});return remapMunicipalFlag(city,flag,emblems,texts,identity);}
 if(operation.type==='remove-symbol'&&emblems.length){emblems.splice(Number.isInteger(operation.index)?Math.max(0,Math.min(emblems.length-1,operation.index)):emblems.length-1,1);return remapMunicipalFlag(city,flag,emblems,texts,identity);}
 if(operation.type==='replace-symbol'&&emblems.length){const index=Math.max(0,Math.min(emblems.length-1,Number(operation.index)||0)),skin=weightedSprite(city,null,new Set(emblems.filter((_,i)=>i!==index).map(emblem=>emblem.skin)));emblems[index]={...emblems[index],skin};return Object.freeze({...flag,emblems:Object.freeze(emblems.map(Object.freeze))});}
 if(operation.type==='add-text'&&texts.length<2&&String(operation.value||'').trim()){
  const candidates=PARTY_FLAG_LAYOUTS.filter(layout=>layout.count===emblems.length&&layout.textBoxes.length===texts.length+1),layout=candidates[Math.floor(city.random()*candidates.length)];if(!layout)return flag;
  const value=String(operation.value).trim(),next=[...texts,{value,kind:'phrase',color:flag.colors?.[2]||flag.foreground}];return remapMunicipalFlag(city,flag,layout.slots.map((_,index)=>emblems[index]),next,identity);
 }
 if(operation.type==='remove-text'&&texts.length){texts.pop();return remapMunicipalFlag(city,flag,emblems,texts,identity);}
 if(operation.type==='edit-text'&&texts.length&&String(operation.value||'').trim()){const index=Math.max(0,Math.min(texts.length-1,Number(operation.index)||0));texts[index].value=String(operation.value).trim();return Object.freeze({...flag,texts:Object.freeze(texts.map(Object.freeze))});}
 if(operation.type==='regenerate')return makeMunicipalFlag(city,identity);
 return flag;
}
function strongestFlagColor(candidates,against,excluded=[],fallback){
 const blocked=new Set(excluded),colors=[...new Set(candidates.filter(color=>typeof color==='string'&&/^#[\da-f]{6}$/i.test(color)&&!blocked.has(color)))];let best=null,bestScore=-1;
 for(const color of colors){const score=against.length?Math.min(...against.map(other=>flagContrast(color,other))):1;if(score>bestScore){best=color;bestScore=score;}}
 return best||fallback;
}
function flagSymbols(flag){return flag?.emblems?.length?flag.emblems:flag?.skin?[{skin:flag.skin}]:[];}
export function makeMergedPartyFlag(city,index,party,sourceFlag,destinationFlag){
 const parents=[sourceFlag,destinationFlag].filter(Boolean),backgroundOwner=parents[Math.floor(city.random()*parents.length)],fallbackBg=randomColor(city.random()*360,.19,.78),inheritedBackground=/^#[\da-f]{6}$/i.test(backgroundOwner?.background||'')?backgroundOwner.background:fallbackBg;
 const parentSwatches=parents.flatMap(flag=>[flag.foreground,flag.background,...(flag.colors||[])]).filter(color=>typeof color==='string'&&/^#[\da-f]{6}$/i.test(color));
 const fallbackForeground=flagContrast(inheritedBackground,'#f5e9bf')>=flagContrast(inheritedBackground,'#17244b')?'#f5e9bf':'#17244b',legacyForeground=strongestFlagColor(parentSwatches,[inheritedBackground],[inheritedBackground],fallbackForeground);
 const inheritedPatterns=parents.map(flag=>flag.colors?.[1]).filter(color=>/^#[\da-f]{6}$/i.test(color||'')&&color!==inheritedBackground&&flagContrast(inheritedBackground,color)>=2.4),legacyPattern=inheritedPatterns.length?inheritedPatterns[Math.floor(city.random()*inheritedPatterns.length)]:strongestFlagColor(parentSwatches,[inheritedBackground],[inheritedBackground],legacyForeground);
 const legacyTextColor=strongestFlagColor(parents.map(flag=>flag.colors?.[2]).concat(parentSwatches,[legacyForeground]),[inheritedBackground,legacyPattern],[inheritedBackground,legacyPattern],legacyForeground),legacyIconColor=strongestFlagColor(parents.map(flag=>flag.colors?.[3]).concat(parentSwatches,[legacyForeground]),[inheritedBackground,legacyPattern,legacyTextColor],[inheritedBackground,legacyPattern,legacyTextColor],legacyForeground),legacyColors=Object.freeze([inheritedBackground,legacyPattern,legacyTextColor,legacyIconColor]),palette=choosePartyPalette(city,()=>({background:inheritedBackground,foreground:legacyForeground,colors:legacyColors,colorSource:'merged'})),{background,foreground,colors}=palette,pattern=colors[1],textColor=colors[2],iconColor=colors[3];
 const backgroundStyle=backgroundOwner?.backgroundStyle||parents.find(flag=>flag.backgroundStyle)?.backgroundStyle||'solid',preferredLayouts=parents.map(flag=>flag.textLayout).filter(id=>id&&!TEXT_ONLY_LAYOUT_IDS.has(id)),allTextLayouts=TEXT_LAYOUTS.filter(layout=>!TEXT_ONLY_LAYOUT_IDS.has(layout.id)),compatible=allTextLayouts.filter(layout=>textLayoutCompatible(layout,backgroundStyle,120/76)),layoutPool=compatible.length?compatible:allTextLayouts,preferred=layoutPool.filter(layout=>preferredLayouts.includes(layout.id)),textLayout=(preferred.length?preferred:layoutPool)[Math.floor(city.random()*(preferred.length?preferred:layoutPool).length)];
 const sourceSymbols=flagSymbols(sourceFlag),destinationSymbols=flagSymbols(destinationFlag),used=new Set(),chosen=[];
 const takeFrom=pool=>{const available=pool.filter(emblem=>emblem?.skin&&!used.has(emblem.skin));if(!available.length)return;const emblem=available[Math.floor(city.random()*available.length)];chosen.push(emblem);used.add(emblem.skin);};
 takeFrom(sourceSymbols);takeFrom(destinationSymbols);
 const inherited=[...sourceSymbols,...destinationSymbols].filter(emblem=>emblem?.skin&&!used.has(emblem.skin)),targetCount=2+Math.floor(city.random()*3);
 while(chosen.length<targetCount&&inherited.length){const index=Math.floor(city.random()*inherited.length),[emblem]=inherited.splice(index,1);if(used.has(emblem.skin))continue;chosen.push(emblem);used.add(emblem.skin);}
 while(chosen.length<targetCount){const skin=weightedSprite(city,party,used);if(!skin)break;used.add(skin);chosen.push({skin});}
 const count=chosen.length||1,arrangements=ICON_LAYOUTS[count]||ICON_LAYOUTS[1],arrangement=arrangements[Math.floor(city.random()*arrangements.length)],layout=PARTY_FLAG_LAYOUTS.find(item=>item.id===`${count}-${arrangement.name}-${textLayout.id}`),detailModes=new Map(),emblems=Object.freeze(layout.slots.map((slot,slotIndex)=>{
  const source=chosen[slotIndex],detailGroup=slot.detailGroup??slotIndex;if(!detailModes.has(detailGroup))detailModes.set(detailGroup,source.detailMode||(city.random()<.8?'detailed':'flat'));
  return Object.freeze({skin:source.skin,x:layout.iconArea.x+slot.x*layout.iconArea.w,y:layout.iconArea.y+slot.y*layout.iconArea.h,w:slot.w*layout.iconArea.w,h:slot.h*layout.iconArea.h,...(source.crop?{crop:Object.freeze({...source.crop})}:{}),...(slot.clip?{clip:Object.freeze({x:layout.iconArea.x+slot.clip.x*layout.iconArea.w,y:layout.iconArea.y+slot.clip.y*layout.iconArea.h,w:slot.clip.w*layout.iconArea.w,h:slot.clip.h*layout.iconArea.h})}:{}),color:iconColor,shade:iconColor,detailMode:detailModes.get(detailGroup),backgroundMode:source.backgroundMode||'transparent'});
 })),texts=buildTexts(city,party,layout.textBoxes,colors);
 return Object.freeze({foreground,background,colors,paletteVersion:3,detailVersion:1,pattern:0,backgroundStyle,layoutId:layout.id,layoutName:arrangement.name,textLayout:layout.textLayout,colorSource:palette.colorSource==='merged'?'merged':'merged-palette-generator',mergedFrom:[sourceFlag?.partyId??null,destinationFlag?.partyId??null].filter(id=>id!=null),emblems,texts,politicalPosition:party?.ideology?politicalPosition(ideologicalProfile(party).economy):null});
}
export function upgradePartyFlagPalette(city,flag){
 if(!flag)return flag;const updatePalette=flag.paletteVersion<2,updateScheme=flag.paletteVersion<3,updateDetails=(flag.detailVersion||0)<1;if(!updatePalette&&!updateScheme&&!updateDetails)return flag;
 const legacyColors=updatePalette||!flag.colors?.length?flagPalette(city,0,flag.background||'#222222',flag.foreground||'#f5e9bf'):flag.colors,legacy={background:flag.background||'#222222',foreground:flag.foreground||'#f5e9bf',colors:legacyColors,colorSource:flag.colorSource||'legacy'},palette=updateScheme?choosePartyPalette(city,()=>legacy):null,colors=palette?.colors||legacyColors,background=palette?.background||flag.background,foreground=palette?.foreground||flag.foreground;
 const sourceEmblems=flag.emblems|| (flag.skin?[{skin:flag.skin,x:.3,y:.12,w:.4,h:.76}]:[]);
 const emblems=Object.freeze(sourceEmblems.map(emblem=>Object.freeze({...emblem,...(updatePalette||updateScheme?{color:colors[3],shade:colors[3]}:{}),detailMode:emblem.detailMode||(city.random()<.8?'detailed':'flat')})));
 const texts=Object.freeze((flag.texts||[]).map(text=>Object.freeze({...text,...(updatePalette||updateScheme?{color:colors[2]}:{})})));
 return Object.freeze({...flag,background,foreground,colors,paletteVersion:3,detailVersion:1,colorSource:palette?.colorSource||flag.colorSource||'legacy',emblems,texts});
}
function requestImage(filename,onReady){
 let image=imageCache.get(filename);if(image?.complete&&image.naturalWidth)return image;
 if(typeof Image==='undefined')return null;
 if(!image){const asset=ASSET_DATA.find(row=>row.filename===filename);if(!asset)return null;image=new Image();imageCache.set(filename,image);image.onload=()=>{for(const callback of pendingImages.get(filename)||[])callback();pendingImages.delete(filename);};image.src=`data:image/png;base64,${asset.base64}`;}
 if(onReady){let callbacks=pendingImages.get(filename);if(!callbacks)pendingImages.set(filename,callbacks=new Set());callbacks.add(onReady);}return null;
}
function tintedSprite(filename,foreground,shade,background,transparent,onReady){
 const raw=requestImage(filename,onReady);if(!raw)return null;const key=`${filename}:${foreground}:${shade}:${background}:${transparent?'cutout':'tile'}`;if(tintedCache.has(key))return tintedCache.get(key);
 const canvas=document.createElement('canvas');canvas.width=raw.naturalWidth;canvas.height=raw.naturalHeight;const context=canvas.getContext('2d');context.drawImage(raw,0,0);const pixels=context.getImageData(0,0,canvas.width,canvas.height),data=pixels.data,fg=foreground.match(/\w\w/g).map(v=>parseInt(v,16)),sh=shade.match(/\w\w/g).map(v=>parseInt(v,16)),bg=background.match(/\w\w/g).map(v=>parseInt(v,16));
 if(transparent){
  const width=canvas.width,height=canvas.height,counts=new Map();
  for(let x=0;x<width;x++)for(const y of [0,height-1]){const i=(y*width+x)*4;if(data[i+3]){const key=[data[i]>>3,data[i+1]>>3,data[i+2]>>3].join(',');counts.set(key,(counts.get(key)||0)+1);}}
  for(let y=1;y<height-1;y++)for(const x of [0,width-1]){const i=(y*width+x)*4;if(data[i+3]){const key=[data[i]>>3,data[i+1]>>3,data[i+2]>>3].join(',');counts.set(key,(counts.get(key)||0)+1);}}
  let edgeKey='',edgeCount=0;for(const [key,count] of counts)if(count>edgeCount){edgeKey=key;edgeCount=count;}
  const existingTransparency=Array.from({length:width*height},(_,i)=>data[i*4+3]).some(alpha=>alpha===0);
  const parts=edgeKey.split(',').map(Number),seed=[parts[0]*8+4,parts[1]*8+4,parts[2]*8+4],edgeLuminance=seed[0]*.2126+seed[1]*.7152+seed[2]*.0722,eligible=existingTransparency||edgeCount>=Math.max(3,Math.ceil((width*2+height*2-4)*.22));
  if(!eligible){tintedCache.set(key,null);return null;}
  // Dark edge fields in this sprite set are usually baked-in black backdrops;
  // light edge fields are often real tile art (brickwork, stone patterns).
  if(!existingTransparency&&edgeLuminance>=128){tintedCache.set(key,null);return null;}
  if(!existingTransparency){
   const visited=new Uint8Array(width*height),stack=[];const push=(x,y)=>{const p=y*width+x;if(visited[p])return;visited[p]=1;const i=p*4;if(!data[i+3])return;const dr=data[i]-seed[0],dg=data[i+1]-seed[1],db=data[i+2]-seed[2];if(dr*dr+dg*dg+db*db<=48*48)stack.push(p);};
   for(let x=0;x<width;x++){push(x,0);push(x,height-1);}for(let y=1;y<height-1;y++){push(0,y);push(width-1,y);}
   let removed=0;while(stack.length){const p=stack.pop(),x=p%width,y=Math.floor(p/width),i=p*4;data[i+3]=0;removed++;if(x>0)push(x-1,y);if(x+1<width)push(x+1,y);if(y>0)push(x,y-1);if(y+1<height)push(x,y+1);}
   if(removed>width*height*.94){tintedCache.set(key,null);return null;}
  }
 }
 for(let i=0;i<data.length;i+=4){if(!data[i+3])continue;const color=data[i]+data[i+1]+data[i+2]>380?fg:(transparent?sh:bg);data[i]=color[0];data[i+1]=color[1];data[i+2]=color[2];}
 context.putImageData(pixels,0,0);tintedCache.set(key,canvas);return canvas;
}
function drawText(ctx,text,flag,x,y,w,h){
 const rotation=text.rotation||0,axisLength=rotation? h:w,boxHeight=rotation?w:h,centerX=x+w/2,centerY=y+h/2;ctx.save();ctx.translate(centerX,centerY);if(rotation)ctx.rotate(rotation);ctx.textAlign='center';ctx.textBaseline='middle';ctx.imageSmoothingEnabled=false;
 let size=Math.max(5,boxHeight*.74);ctx.font=`bold ${size}px monospace`;while(ctx.measureText(text.value).width>axisLength*.96&&size>4){size--;ctx.font=`bold ${size}px monospace`;}
 ctx.fillStyle=text.color||flag.colors?.[2]||flag.foreground;drawPixelText(ctx,text.value,0,0,axisLength*.96);ctx.restore();
}
function internalDetailColor(primary,flag){
 const background=flag.background,candidates=[flag.colors?.[2],flag.foreground,flag.colors?.[1],'#f5e9bf','#17244b'].filter((color,index,all)=>color&&color!==primary&&all.indexOf(color)===index);
 let best=null,score=-1;
 for(const color of candidates){const detailContrast=flagContrast(primary,color),fieldContrast=flagContrast(background,color);if(detailContrast<1.7||fieldContrast<1.7)continue;const value=detailContrast+Math.min(fieldContrast,5)*.3;if(value>score){best=color;score=value;}}
 if(best)return best;
 return flagContrast(primary,'#ffffff')+flagContrast(background,'#ffffff')>=flagContrast(primary,'#111111')+flagContrast(background,'#111111')?'#ffffff':'#111111';
}
function starPath(ctx,cx,cy,outer,inner,points=5){ctx.beginPath();for(let i=0;i<points*2;i++){const angle=-Math.PI/2+i*Math.PI/points,r=i%2?inner:outer,x=cx+Math.cos(angle)*r,y=cy+Math.sin(angle)*r;if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.closePath();}
function fillStripes(ctx,x,y,w,h,orientation,count,reverse=false){
 const horizontal=orientation==='horizontal',diagonal=orientation==='diagonal'||orientation==='diagonal-reverse';if(!diagonal){const total=horizontal?h:w,step=total/count;for(let i=0;i<count;i+=2)if(horizontal)ctx.fillRect(x,y+i*step,w,step+.5);else ctx.fillRect(x+i*step,y,step+.5,h);return;}
 const span=Math.hypot(w,h),step=span/count;ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.translate(x+w/2,y+h/2);ctx.rotate((reverse?1:-1)*Math.PI/4);for(let i=-count*2;i<count*2;i++)if(((i+count*4)%count+count)%count<Math.ceil(count/2))ctx.fillRect(i*step,-span,step,span*2);ctx.restore();
}
function circlePath(ctx,cx,cy,r){ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();}
function drawSunburst(ctx,cx,cy,rays,outer){for(let i=0;i<rays;i+=2){const a=i*Math.PI*2/rays,b=(i+1)*Math.PI*2/rays,c=(i+2)*Math.PI*2/rays;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.cos(a)*outer,cy+Math.sin(a)*outer);ctx.lineTo(cx+Math.cos(b)*outer,cy+Math.sin(b)*outer);ctx.lineTo(cx+Math.cos(c)*outer,cy+Math.sin(c)*outer);ctx.closePath();ctx.fill();}}
function drawFlagBackground(ctx,flag,x,y,w,h){
 const colors=flag.colors?.length?flag.colors:[flag.background,flag.foreground],accent=colors[1]||flag.foreground,style=flag.backgroundStyle;
 ctx.fillStyle=flag.background;ctx.fillRect(x,y,w,h);ctx.fillStyle=colors[1]||flag.foreground;
 if(!style){if(flag.pattern===1)ctx.fillRect(x,y+h*.42,w,h*.16);else if(flag.pattern===2){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w*.5,y+h*.5);ctx.lineTo(x,y+h);ctx.fill();}return;}
 const polygon=points=>{ctx.beginPath();points.forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py));ctx.closePath();ctx.fill();};
 if(style==='bicolor-diagonal'||style==='bicolor-diagonal-reverse'){
  const reverse=style.endsWith('reverse');polygon(reverse?[[x,y],[x+w,y],[x,y+h]]:[[x+w,y],[x+w,y+h],[x,y+h]]);return;
 }
 if(style==='diagonal-band'||style==='diagonal-band-reverse'||style==='diagonal-band-double'){
  ctx.save();ctx.translate(x+w/2,y+h/2);ctx.rotate(style.includes('reverse')?Math.PI/4:-Math.PI/4);const band=Math.min(w,h)*(style==='diagonal-band-double'?.12:.24);ctx.fillRect(-w,-band/2,w*2,band);if(style==='diagonal-band-double'){ctx.fillRect(-w,-band*1.25,w*2,band*.35);ctx.fillRect(-w,band*.9,w*2,band*.35);}ctx.restore();return;
 }
 if(['triangle-hoist','triangle-fly','triangle-top-wide','triangle-bottom-wide','pile-left','pile-right','pile-top','pile-bottom'].includes(style)){
  if(style==='triangle-hoist'||style==='pile-left')polygon([[x,y],[x+w*.52,y+h/2],[x,y+h]]);
  else if(style==='triangle-fly'||style==='pile-right')polygon([[x+w,y],[x+w,y+h],[x+w*.48,y+h/2]]);
  else if(style==='triangle-top-wide'||style==='pile-top')polygon([[x,y],[x+w,y],[x+w/2,y+h*.58]]);
  else polygon([[x,y+h],[x+w,y+h],[x+w/2,y+h*.42]]);return;
 }
 if(style==='chevron-band'||style==='chevron-band-reverse'){
  const reverse=style.endsWith('reverse'),points=reverse?[[x+w,y],[x+w*.42,y+h/2],[x+w,y+h],[x+w*.78,y+h],[x+w*.2,y+h/2],[x+w*.78,y]]:[[x,y],[x+w*.22,y],[x+w*.8,y+h/2],[x+w*.22,y+h],[x,y+h],[x+w*.58,y+h/2]];polygon(points);return;
 }
 if(style==='pall'||style==='pall-inverted'){
  const inv=style==='pall-inverted';polygon(inv?[[x,y+h],[x+w*.22,y+h],[x+w/2,y+h*.52],[x+w*.78,y+h],[x+w,y+h],[x+w/2,y]]:[[x,y],[x+w*.22,y],[x+w/2,y+h*.48],[x+w*.78,y],[x+w,y],[x+w/2,y+h]]);return;
 }
 const gyronny=style.match(/^gyronny-(4|6|8)$/);if(gyronny){const count=Number(gyronny[1]),cx=x+w/2,cy=y+h/2,outer=Math.hypot(w,h);for(let i=0;i<count;i+=2){const a=-Math.PI/2+i*Math.PI*2/count,b=a+Math.PI*2/count;polygon([[cx,cy],[cx+Math.cos(a)*outer,cy+Math.sin(a)*outer],[cx+Math.cos(b)*outer,cy+Math.sin(b)*outer]]);}return;}
 if(style==='diagonal-quarter'||style==='diagonal-quarter-reverse'||style==='saltire-quartered'){
  if(style==='saltire-quartered'){const cx=x+w/2,cy=y+h/2;polygon([[x,y],[x+w,y],[cx,cy]]);polygon([[x,y+h],[x+w,y+h],[cx,cy]]);}
  else if(style==='diagonal-quarter')polygon([[x,y],[x+w,y],[x,y+h]]);else polygon([[x+w,y],[x+w,y+h],[x,y+h]]);return;
 }
 if(style==='lozengy-diagonal'){for(let i=-1;i<5;i++){ctx.beginPath();ctx.moveTo(x+i*w/4,y);ctx.lineTo(x+(i+1)*w/4,y);ctx.lineTo(x+(i+2)*w/4,y+h);ctx.lineTo(x+(i+1)*w/4,y+h);ctx.closePath();ctx.fill();}return;}
 if(style==='cross-fimbriated'||style==='cross-offset'||style==='nordic-cross-centered'||style==='nordic-cross-double'||style==='cross-four-cantons'){
  const cx=style==='cross-offset'?x+w*.38:x+w*.5,wide=Math.min(w,h)*(style==='cross-fimbriated'?.3:.22),narrow=wide*.58;ctx.fillStyle=accent;ctx.fillRect(cx-wide/2,y,wide,h);ctx.fillRect(x,y+h/2-wide/2,w,wide);
  if(style==='cross-fimbriated'){ctx.fillStyle=flag.foreground;ctx.fillRect(cx-narrow/2,y,narrow,h);ctx.fillRect(x,y+h/2-narrow/2,w,narrow);ctx.fillStyle=accent;}
  if(style==='nordic-cross-double'){ctx.fillRect(cx+wide*.7-wide*.18,y,wide*.36,h);ctx.fillRect(x,y+h/2+wide*.7-wide*.18,w,wide*.36);}if(style==='cross-four-cantons'){const size=Math.min(w,h)*.18;for(const [px,py]of [[.12,.12],[.72,.12],[.12,.72],[.72,.72]])ctx.fillRect(x+w*px,y+h*py,w*size,h*size);}return;
 }
 if(style==='cross-canton'||style==='canton-cross'||style==='canton-star'||style==='canton-circle'||style==='canton-double'||style==='canton-striped'||style==='canton-diagonal'){
  const cw=w*.52,ch=h*.54;ctx.fillRect(x,y,cw,ch);ctx.fillStyle=flag.background;
  if(style==='cross-canton'||style==='canton-cross'){ctx.fillRect(x+cw*.42,y,cw*.16,ch);ctx.fillRect(x,y+ch*.42,cw,ch*.16);}
  else if(style==='canton-diagonal')polygon([[x,y],[x+cw,y],[x,y+ch]]);
  else if(style==='canton-star'){starPath(ctx,x+cw*.5,y+ch*.5,Math.min(cw,ch)*.34,Math.min(cw,ch)*.15);ctx.fill();}
  else if(style==='canton-double'){ctx.fillStyle=accent;ctx.fillRect(x+cw,y+ch,w-cw,h-ch);}
  else if(style==='canton-circle'){circlePath(ctx,x+cw*.5,y+ch*.5,Math.min(cw,ch)*.32);}
  else if(style==='canton-striped'){ctx.fillStyle=accent;for(let i=0;i<4;i++)ctx.fillRect(x,y+ch*i/4,cw,ch/8);}
  return;
 }
 if(style==='fess-narrow'||style==='fess-wide'||style==='fess-double'||style==='chief'||style==='base-stripe'){
  const hh=style==='fess-narrow'?.13:style==='fess-wide'?.42:.2;if(style==='chief')ctx.fillRect(x,y,w,h*.27);else if(style==='base-stripe')ctx.fillRect(x,y+h*.73,w,h*.27);else{ctx.fillRect(x,y+h*(.5-hh/2),w,h*hh);if(style==='fess-double'){ctx.fillRect(x,y+h*.22,w,h*.1);ctx.fillRect(x,y+h*.68,w,h*.1);}}return;
 }
 if(style==='pale-wide-left'||style==='pale-wide-center'||style==='pale-wide-right'||style==='pale-double'||style==='hoist-stripe'||style==='fly-stripe'){
  if(style==='hoist-stripe')ctx.fillRect(x,y,w*.22,h);else if(style==='fly-stripe')ctx.fillRect(x+w*.78,y,w*.22,h);else if(style==='pale-double'){ctx.fillRect(x+w*.25,y,w*.12,h);ctx.fillRect(x+w*.63,y,w*.12,h);}else{const center=style==='pale-wide-left'?0:style==='pale-wide-center'?.36:.72;ctx.fillRect(x+w*center,y,w*.28,h);}return;
 }
 if(style==='bordure'||style==='bordure-double'||style==='bordure-canton'||style==='central-frame'||style==='central-disc-ring'||style==='central-medallion'){
  const t=Math.min(w,h)*(style==='central-medallion'?.08:.12);if(style==='central-frame'){ctx.fillRect(x+w*.18,y+h*.16,w*.64,h*.68);ctx.fillStyle=flag.background;ctx.fillRect(x+w*.24,y+h*.23,w*.52,h*.54);}
  else if(style==='central-disc-ring'||style==='central-medallion'){circlePath(ctx,x+w*.5,y+h*.5,Math.min(w,h)*.42);ctx.fillStyle=flag.background;circlePath(ctx,x+w*.5,y+h*.5,Math.min(w,h)*(style==='central-disc-ring'?.3:.27));if(style==='central-medallion'){ctx.fillStyle=accent;circlePath(ctx,x+w*.5,y+h*.5,Math.min(w,h)*.12);}}
  else{ctx.fillRect(x,y,w,t);ctx.fillRect(x,y+h-t,w,t);ctx.fillRect(x,y,t,h);ctx.fillRect(x+w-t,y,t,h);if(style==='bordure-double'){const u=t*1.8;ctx.fillStyle=flag.background;ctx.fillRect(x+u,y+u,w-2*u,h-2*u);}if(style==='bordure-canton'){ctx.fillStyle=flag.background;ctx.fillRect(x+t,y+t,w*.45,h*.42);}}return;
 }
 if(style==='crescent-left'||style==='crescent-right'||style==='crescent-center'||style==='crescent-star-left'||style==='crescent-star-right'){
  const right=style.endsWith('right'),cx=x+w*(style.endsWith('center')?.5:right?.72:.28),cy=y+h*.5,r=Math.min(w,h)*.36;circlePath(ctx,cx,cy,r);ctx.fillStyle=flag.background;circlePath(ctx,cx+(right?-1:1)*r*.42,cy-r*.1,r*.82);return;
 }
 if(style==='sunburst-canton'||style==='sunburst-left'){const cx=x+w*(style==='sunburst-canton'?.22:.32),cy=y+h*(style==='sunburst-canton'?.26:.5);drawSunburst(ctx,cx,cy,16,Math.min(w,h)*.48);circlePath(ctx,cx,cy,Math.min(w,h)*.16);return;}
 if(style==='wave-band'||style==='wave-band-double'){const bands=style==='wave-band-double'?2:1;for(let row=0;row<bands;row++){const cy=y+h*(.42+row*.3),th=h*.2;ctx.beginPath();ctx.moveTo(x,cy-th/2);for(let i=0;i<=32;i++)ctx.lineTo(x+w*i/32,cy+Math.sin(i/32*Math.PI*4)*th*.45);for(let i=32;i>=0;i--)ctx.lineTo(x+w*i/32,cy+Math.sin(i/32*Math.PI*4)*th*.45+th);ctx.closePath();ctx.fill();}return;}
 if(style==='sawtooth-top'||style==='sawtooth-bottom'||style==='sawtooth-left'||style==='sawtooth-right'||style==='serrated-hoist'||style==='serrated-fly'){
  const horizontal=style==='sawtooth-top'||style==='sawtooth-bottom',teeth=8;if(horizontal){const top=style==='sawtooth-top';ctx.beginPath();ctx.moveTo(x,top?y:y+h);for(let i=0;i<teeth;i++)ctx.lineTo(x+w*(i+.5)/teeth,top?y+h*.24:y+h*.76),ctx.lineTo(x+w*(i+1)/teeth,top?y:y+h);ctx.lineTo(x+w,top?y:y+h);ctx.lineTo(x+w,top?y+h:y);ctx.lineTo(x,top?y+h:y);ctx.closePath();ctx.fill();}
  else{const left=style==='sawtooth-left'||style==='serrated-hoist';ctx.beginPath();ctx.moveTo(left?x+w:x,y);ctx.lineTo(left?x:x+w,y);for(let i=0;i<teeth;i++)ctx.lineTo(left?x+w*.24:x+w*.76,y+h*(i+.5)/teeth),ctx.lineTo(left?x:x+w,y+h*(i+1)/teeth);ctx.lineTo(left?x:x+w,y+h);ctx.lineTo(left?x+w:x,y+h);ctx.closePath();ctx.fill();}return;
 }
 if(style==='quartered-cross'){
  ctx.fillRect(x,y,w/2,h/2);ctx.fillRect(x+w/2,y+h/2,w/2,h/2);ctx.fillStyle=flag.background;ctx.fillRect(x+w*.42,y,w*.16,h);ctx.fillRect(x,y+h*.42,w,h*.16);return;
 }
 const stripes=style.match(/^stripes-(horizontal|vertical|diagonal|diagonal-reverse)(?:-(\d+))?$/);if(stripes){fillStripes(ctx,x,y,w,h,stripes[1],Number(stripes[2]||5));return;}
 const checks=style.match(/^checkerboard-(\d+)$/);if(checks){const n=Number(checks[1]),cw=w/n,ch=h/n;for(let row=0;row<n;row++)for(let col=0;col<n;col++)if((row+col)%2===0)ctx.fillRect(x+col*cw,y+row*ch,cw+.5,ch+.5);return;}
 const canton=style.match(/^canton-(top|bottom)-(left|right)$/);if(canton){ctx.fillRect(x+(canton[2]==='right'?w*.56:0),y+(canton[1]==='bottom'?h*.52:0),w*.44,h*.48);return;}
 if(style==='quartered'){ctx.fillRect(x,y,w/2,h/2);ctx.fillRect(x+w/2,y+h/2,w/2,h/2);return;}
 if(style==='plaid'){fillStripes(ctx,x,y,w,h,'horizontal',6);fillStripes(ctx,x,y,w,h,'vertical',6);return;}
 if(style==='grid'){ctx.lineWidth=Math.max(1,Math.min(w,h)*.035);for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(x+w*i/4,y);ctx.lineTo(x+w*i/4,y+h);ctx.strokeStyle=accent;ctx.stroke();ctx.beginPath();ctx.moveTo(x,y+h*i/4);ctx.lineTo(x+w,y+h*i/4);ctx.stroke();}return;}
 if(style==='circle'||style==='double-circle'||style==='circle-small'||style==='circle-large'||style==='circle-left'||style==='circle-right'||style==='circle-top'||style==='circle-bottom'||style==='sun-disc-left'||style==='sunrise'||style==='triple-circles-horizontal'||style==='triple-circles-vertical'){
  const r=Math.min(w,h)*(style==='circle-small'?.2:style==='circle-large'?.43:style==='double-circle'?.36:.31),positions=style==='circle-left'||style==='sun-disc-left'?[[.28,.5]]:style==='circle-right'?[[.72,.5]]:style==='circle-top'?[[.5,.28]]:style==='circle-bottom'||style==='sunrise'?[[.5,.72]]:style==='triple-circles-horizontal'?[[.22,.5],[.5,.5],[.78,.5]]:style==='triple-circles-vertical'?[[.5,.24],[.5,.5],[.5,.76]]:[[.5,.5]];
  for(const [px,py]of positions){if(style==='sunrise'){ctx.save();ctx.beginPath();ctx.rect(x,y,w,h*.72);ctx.clip();}if(style==='sun-disc-left')drawSunburst(ctx,x+w*px,y+h*py,16,r*2.35);circlePath(ctx,x+w*px,y+h*py,r);if(style==='double-circle'){ctx.fillStyle=flag.background;circlePath(ctx,x+w*px,y+h*py,r*.53);ctx.fillStyle=accent;}if(style==='sunrise')ctx.restore();}return;
 }
 if(style==='sunburst'){drawSunburst(ctx,x+w*.5,y+h*.48,16,Math.min(w,h)*.58);return;}
 if(style==='diamond'||style==='diamond-left'||style==='diamond-right'||style==='diamonds-2'||style==='lozengy'){
  const diamond=(cx,cy,rx,ry)=>{ctx.beginPath();ctx.moveTo(cx,cy-ry);ctx.lineTo(cx+rx,cy);ctx.lineTo(cx,cy+ry);ctx.lineTo(cx-rx,cy);ctx.closePath();ctx.fill();};
  if(style==='diamond-left')diamond(x+w*.27,y+h*.5,w*.27,h*.38);else if(style==='diamond-right')diamond(x+w*.73,y+h*.5,w*.27,h*.38);else if(style==='diamonds-2'){diamond(x+w*.3,y+h*.5,w*.24,h*.34);diamond(x+w*.7,y+h*.5,w*.24,h*.34);}else if(style==='lozengy'){for(let row=-1;row<4;row++)for(let col=-1;col<5;col++)if((row+col)%2===0)diamond(x+col*w/4,y+row*h/3,w/4,h/3);}else diamond(x+w*.5,y+h*.5,w*.32,h*.42);return;
 }
 if(style==='star'||style==='stars-2'||style==='stars-3'||style==='stars-5'||style==='star-canton'){
  const count=style==='stars-2'?2:style==='stars-3'?3:style==='stars-5'?5:1,points=5,rad=Math.min(w,h)*(style==='star-canton'?.17:count>1?.11:.34),positions=style==='star-canton'?[[.22,.25]]:count===1?[[.5,.5]]:Array.from({length:count},(_,i)=>[.18+i*.64/Math.max(1,count-1),.5]);for(const [px,py]of positions){starPath(ctx,x+w*px,y+h*py,rad,rad*.46,points);ctx.fill();}return;
 }
 if(style==='cross'||style==='double-cross'||style==='nordic-cross-left'||style==='nordic-cross-right'){
  const cx=style==='nordic-cross-left'?x+w*.36:style==='nordic-cross-right'?x+w*.64:x+w*.5,thick=w*.12;ctx.fillRect(cx-thick/2,y+h*.12,thick,h*.76);ctx.fillRect(x+w*.08,y+h*.5-h*.08,w*.84,h*.16);if(style==='double-cross'){ctx.fillRect(x+w*.08,y+h*.25,w*.84,h*.1);ctx.fillRect(x+w*.08,y+h*.65,w*.84,h*.1);}return;
 }
 if(style==='saltire'||style==='cross-diagonal'){ctx.save();ctx.translate(x+w/2,y+h/2);ctx.rotate(Math.PI/4);ctx.fillRect(-w*.09,-h*.8,w*.18,h*1.6);ctx.fillRect(-w*.8,-h*.09,w*1.6,h*.18);ctx.restore();return;}
 const chevrons=style.match(/^chevrons-(\d+)$/);if(style==='chevron'||style==='chevron-right'||chevrons){const count=Number(chevrons?.[1]||1),right=style==='chevron-right';for(let i=0;i<count;i++){const shift=i*.18,base=right?x+w*(.68-shift):x+w*(.08+shift),tip=right?x+w*(.92-shift):x+w*(.4+shift);ctx.beginPath();ctx.moveTo(base,y+h*.08);ctx.lineTo(tip,y+h*.5);ctx.lineTo(base,y+h*.92);ctx.lineTo(base+w*.12,y+h*.92);ctx.lineTo(tip+w*.12,y+h*.5);ctx.lineTo(base+w*.12,y+h*.08);ctx.closePath();ctx.fill();}return;}
 if(style==='border'||style==='double-border'||style==='top-bottom-border'||style==='side-borders'||style==='top-bar'||style==='bottom-bar'){
  const t=Math.max(2,Math.min(w,h)*.1);if(style==='top-bar')ctx.fillRect(x,y,w,h*.2);else if(style==='bottom-bar')ctx.fillRect(x,y+h*.8,w,h*.2);else if(style==='top-bottom-border'){ctx.fillRect(x,y,w,h*.16);ctx.fillRect(x,y+h*.84,w,h*.16);}else if(style==='side-borders'){ctx.fillRect(x,y,w*.13,h);ctx.fillRect(x+w*.87,y,w*.13,h);}else{ctx.lineWidth=t;ctx.strokeStyle=accent;ctx.strokeRect(x+t/2,y+t/2,w-t,h-t);if(style==='double-border')ctx.strokeRect(x+t*1.8,y+t*1.8,w-t*3.6,h-t*3.6);}return;
 }
 if(style==='triangle-left'||style==='triangle-right'||style==='triangle-top'||style==='triangle-bottom'||style==='triangles-4'){
  const triangle=(side)=>{ctx.beginPath();if(side==='left'){ctx.moveTo(x,y);ctx.lineTo(x+w,y+h/2);ctx.lineTo(x,y+h);}else if(side==='right'){ctx.moveTo(x+w,y);ctx.lineTo(x+w,y+h);ctx.lineTo(x,y+h/2);}else if(side==='top'){ctx.moveTo(x,y);ctx.lineTo(x+w,y);ctx.lineTo(x+w/2,y+h);}else{ctx.moveTo(x,y+h);ctx.lineTo(x+w,y+h);ctx.lineTo(x+w/2,y);}ctx.closePath();ctx.fill();};if(style==='triangles-4'){triangle('left');triangle('right');}else triangle(style.slice(9));return;
 }
 if(style==='fess-top'||style==='fess-bottom'){ctx.fillRect(x,y+(style==='fess-bottom'?h*.55:0),w,h*.45);return;}
 if(style==='pale-left'||style==='pale-center'||style==='pale-right'){const i=style==='pale-left'?0:style==='pale-center'?1:2;ctx.fillRect(x+w*i/3,y,w/3,h);return;}
 if(style==='wave-horizontal'||style==='wave-double'||style==='wave-vertical'||style==='wave-diagonal'){
  ctx.save();if(style==='wave-vertical'||style==='wave-diagonal'){ctx.translate(x+w/2,y+h/2);ctx.rotate(Math.PI/2);ctx.translate(-x-w/2,-y-h/2);}const waves=style==='wave-double'?2:1,amplitude=h*.16;for(let row=0;row<waves;row++){const base=y+h*(.34+row*.34);ctx.beginPath();ctx.moveTo(x,base);for(let step=0;step<=24;step++){const px=x+w*step/24,py=base+Math.sin(step/24*Math.PI*4)*amplitude;ctx.lineTo(px,py);}ctx.lineTo(x+w,base+h*.2);for(let step=24;step>=0;step--){const px=x+w*step/24,py=base+Math.sin(step/24*Math.PI*4)*amplitude+h*.2;ctx.lineTo(px,py);}ctx.closePath();ctx.fill();}ctx.restore();return;
 }
 if(style==='dots-small'||style==='dots-large'){const columns=style==='dots-small'?9:5,rows=style==='dots-small'?5:3,r=Math.min(w,h)*(style==='dots-small'?.025:.06);for(let row=0;row<rows;row++)for(let col=0;col<columns;col++)if((row+col)%2===0)circlePath(ctx,x+(col+.5)*w/columns,y+(row+.5)*h/rows,r);return;}
}
function currentTextBox(flag,text){
 const top=flag.textLayout;
 if(top==='frase-em-cima'&&text.kind==='phrase')return{x:.04,y:.015,w:.92,h:.09};
 if(top==='frase-embaixo'&&text.kind==='phrase')return{x:.04,y:.895,w:.92,h:.09};
 if(top==='frase-em-cima-numero-embaixo'||top==='nome-e-numero-em-faixas')return text.kind==='number'?{x:.04,y:.895,w:.92,h:.09}:{x:.04,y:.015,w:.92,h:.09};
 return text;
}
export function drawPartyFlag(ctx,flag,x,y,w=60,h=38,onReady=null){
 if(!flag)return;ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();drawFlagBackground(ctx,flag,x,y,w,h);
 const emblems=flag.emblems?.length?flag.emblems:flag.skin?[{skin:flag.skin,x:.3,y:.12,w:.4,h:.76}]:[];
 for(const emblem of emblems){
  const contained=patternContainsRect(flag.backgroundStyle,{x:emblem.x,y:emblem.y,w:emblem.w,h:emblem.h},w/h);
  let knockout=contained&&flag.colors?.[1]&&flagContrast(flag.background,flag.colors[1])>=3;
  const textInk=flag.colors?.[2],preferredInk=flag.colors?.[3]||flag.foreground,transparent=emblem.backgroundMode!=='tile',detailed=emblem.detailMode!=='flat';
  let ink,shade,image;
  if(knockout){ink=flag.background;shade=detailed?flag.colors[1]:ink;image=tintedSprite(emblem.skin,ink,shade,flag.background,true,onReady);if(!image)knockout=false;}
  if(!knockout){ink=emblem.color===textInk?(preferredInk!==textInk?preferredInk:flag.colors?.[1]||flag.foreground):(emblem.color||preferredInk);shade=detailed?internalDetailColor(ink,flag):ink;image=tintedSprite(emblem.skin,ink,shade,flag.background,transparent,onReady)||tintedSprite(emblem.skin,ink,shade,flag.background,false,onReady);}
  if(!image)continue;
  ctx.save();ctx.imageSmoothingEnabled=false;const dx=x+emblem.x*w,dy=y+emblem.y*h,dw=emblem.w*w,dh=emblem.h*h,crop=emblem.crop,sx=crop?crop.x*image.width:0,sy=crop?crop.y*image.height:0,sw=crop?crop.w*image.width:image.width,sh=crop?crop.h*image.height:image.height,scale=Math.min(dw/sw,dh/sh),drawW=sw*scale,drawH=sh*scale,drawX=dx+(dw-drawW)/2,drawY=dy+(dh-drawH)/2;if(emblem.clip){ctx.beginPath();ctx.rect(x+emblem.clip.x*w,y+emblem.clip.y*h,emblem.clip.w*w,emblem.clip.h*h);ctx.clip();}ctx.drawImage(image,sx,sy,sw,sh,drawX,drawY,drawW,drawH);ctx.restore();
 }
 for(const original of flag.texts||[]){
  const box=currentTextBox(flag,original),contained=patternContainsRect(flag.backgroundStyle,box,w/h);let text=original;
  if(contained&&flag.colors?.[1]&&flagContrast(flag.background,flag.colors[1])>=3){text={...original,color:flag.background};}
  else if(flag.backgroundStyle&&flag.backgroundStyle!=='solid'){
   const ink=flagContrast(flag.background,flag.foreground)>=3?flag.foreground:(flagContrast(flag.background,'#ffffff')>=flagContrast(flag.background,'#111111')?'#ffffff':'#111111');
   ctx.fillStyle=flag.background;ctx.fillRect(x+box.x*w,y+box.y*h,box.w*w,box.h*h);text={...original,color:ink};
  }
  drawText(ctx,text,flag,x+box.x*w,y+box.y*h,box.w*w,box.h*h);
 }
 ctx.strokeStyle=flag.foreground;ctx.strokeRect(x,y,w,h);ctx.restore();
}
export function partyFlagCanvas(flag,onReady){
 const canvas=document.createElement('canvas');canvas.width=120;canvas.height=76;const redraw=()=>{drawPartyFlag(canvas.getContext('2d'),flag,0,0,120,76);onReady?.();};drawPartyFlag(canvas.getContext('2d'),flag,0,0,120,76,redraw);return canvas;
}
