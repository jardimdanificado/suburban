export const BOAT_CLASSES=Object.freeze({
  canoe:{label:'Canoa',capacity:2,speed:1.15,maxWaterTiles:14,scale:.72,color:0x987044},
  launch:{label:'Lancha',capacity:8,speed:1.45,maxWaterTiles:42,scale:1,color:0xe4d3a2},
  ferry:{label:'Balsa',capacity:32,speed:1.2,maxWaterTiles:Infinity,scale:1.5,color:0xd7e0d5},
  cargo:{label:'Navio cargueiro',capacity:10000,speed:.9,maxWaterTiles:Infinity,scale:2.3,color:0x9e6f55},
});

export const INTERCITY_BOAT_CLASSES=Object.freeze({
  canoe:{label:'Canoa',capacity:2,scale:.8},
  launch:{label:'Lancha',capacity:8,scale:1},
  ferry:{label:'Ferry',capacity:32,scale:1.55},
  cargo:{label:'Navio cargueiro',capacity:100,scale:2.25},
});

// Local model dimensions also define the hull contact left on grass and sand.
export const BOAT_HULL_DIMENSIONS=Object.freeze({
  canoe:{length:2.6,width:.65},launch:{length:1.38,width:.56},
  ferry:{length:1.65,width:.72},cargo:{length:2.05,width:.82},
});
