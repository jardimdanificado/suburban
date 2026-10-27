import {BUILDING_TYPES} from './city_simulation.js';
import {INDUSTRIES} from './city_industries.js';
const symbols={townhall:'★',council_chamber:'⚖',bank:'$',clinic:'+',hospital:'+',farm:'🌾',quarry:'⛏',forestry:'♣',mill:'✣',bakery:'◒',market:'▥',greengrocer:'◉',builder:'⚒',carrier:'➜',cleaner:'✦',waste_collector:'♲',recycler:'♲',press:'▤',publisher:'▣',newsroom:'▤',research_institute:'⌕',artisan:'⚒',cycle_workshop:'◉',bike_rack:'◉',popular_refectory:'♨',public_toilet:'WC',paid_toilet:'WC',residential:'⌂',popular_housing:'⌂',luxury_housing:'⌂',library:'▣',park:'♣',kitchen:'♨'};
export function addBuildingSign(THREE,parent,b,ground=0){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=96;const ctx=canvas.getContext('2d'),label=BUILDING_TYPES[b.type]?.label||INDUSTRIES[b.type]?.label||b.type.replaceAll('_',' ');
 ctx.fillStyle='#243a35';ctx.fillRect(0,0,256,96);ctx.strokeStyle='#e5d7a7';ctx.lineWidth=5;ctx.strokeRect(4,4,248,88);
 ctx.fillStyle='#e8c671';ctx.textAlign='center';ctx.font='bold 37px sans-serif';ctx.fillText(symbols[b.type]||'◆',36,61);
 ctx.fillStyle='#fff4d4';ctx.font='bold 19px sans-serif';ctx.fillText(label.toUpperCase(),149,55,185);
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.magFilter=THREE.NearestFilter;
 const sign=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(1.9,b.width*.9),.7),new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide}));sign.userData.partyFlagTexture=map;sign.position.set(b.width/2,ground+1.35,b.depth+.17);parent.add(sign);
}
