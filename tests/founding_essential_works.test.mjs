import test from 'node:test';
import assert from 'node:assert/strict';
import {setup} from './helpers/city.mjs';

const ESSENTIAL_TYPES=['iml','police_station','crematorium','courthouse','jail'];

test('a new city starts the essential justice and forensic buildings as real construction projects',()=>{
  const city=setup({starter:true,population:64,foundingWorks:true});
  const projects=city.development.projects.filter(project=>project.foundingEssential);
  assert.deepEqual(projects.map(project=>project.type),ESSENTIAL_TYPES);
  for(const project of projects){
    assert.equal(project.service,'building');
    assert.equal(project.status,'materials');
    assert.equal(project.accountId,'treasury');
    assert.ok(project.builderId);
    assert.ok(project.stone>0);
    assert.ok(project.requiredLabor>0);
    assert.ok(city.development.plots.find(plot=>plot.id===project.plotId)?.projectId===project.id);
    assert.equal(city.buildings.some(building=>building.type===project.type),false);
  }
});
