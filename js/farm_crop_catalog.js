import {SUBSTANCE_CROPS} from './city_substance_catalog.js';
import {BOTANICAL_CROPS} from './plant_catalog.js';
export const FARM_CROPS = {
  ...BOTANICAL_CROPS,
  ...SUBSTANCE_CROPS,
  arroz:{label:'Arroz',grow:150,price:95},alface:{label:'Alface',grow:75,price:80},tomate:{label:'Tomate',grow:100,price:110},
  girassol: { label: 'Girassol', grow: 100, price: 12, yieldFactor: 4, laborFactor: .65 },
  maca: { label: 'Maçã', grow: 180, price: 100, perennial:true }, goiaba: { label: 'Goiaba', grow: 160, price: 100, plantSpecies:'guava' },
  trigo: { label: 'Trigo', grow: 120, price: 90 }, milho: { label: 'Milho', grow: 100, price: 95 },
  mandioca: { label: 'Mandioca', grow: 200, price: 105 }, cebola: { label: 'Cebola', grow: 140, price: 95 },
  feijao: { label: 'Feijão', grow: 150, price: 100 }, coentro: { label: 'Coentro', grow: 80, price: 90 },
  cevada:{label:'Cevada',grow:125,price:105,nonFood:true},lupulo:{label:'Lúpulo',grow:150,price:190,nonFood:true},uva:{label:'Uva',grow:170,price:150,nonFood:true},agave:{label:'Agave',grow:190,price:180,nonFood:true},
};
