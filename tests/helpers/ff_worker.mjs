// Node adapter for exercising the actual browser worker protocol.
import {parentPort} from 'node:worker_threads';
globalThis.self=globalThis;
globalThis.postMessage=(message,transfer)=>parentPort.postMessage(message,transfer);
await import('../../js/city_sim_worker.js');
parentPort.on('message',data=>{
  self.onmessage({data});
});
parentPort.postMessage({type:'ready'});
