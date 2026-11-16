import test from 'node:test';
import assert from 'node:assert/strict';
import {boatSailsUnderway} from '../js/boat_sails.js';
function boat(){return {position:{x:4,y:0,z:5},userData:{}};}
test('sails stay furled at rest and hoist on horizontal movement',()=>{
 const group=boat();assert.equal(boatSailsUnderway(group,0,true),false);
 group.position.x+=.1;assert.equal(boatSailsUnderway(group,.1,true),true);
 assert.equal(boatSailsUnderway(group,.4,true),true,'worker snapshot gap must not flicker sails');
 assert.equal(boatSailsUnderway(group,1,true),false,'stopped boats furl sails');
});
test('wave bobbing and heading changes do not hoist sails',()=>{
 const group=boat();boatSailsUnderway(group,0,true);group.position.y=2;group.rotation={y:Math.PI};
 assert.equal(boatSailsUnderway(group,.1,true),false);
});
test('boats towed across land keep their sails furled',()=>{
 const group=boat();boatSailsUnderway(group,0,false);group.position.z++;
 assert.equal(boatSailsUnderway(group,.1,false),false);
 group.position.z++;assert.equal(boatSailsUnderway(group,.2,true),true);
});
