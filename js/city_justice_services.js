import {funeralSpec} from './city_funeral_services.js';
export const CUSTODY_SUPPLIES=Object.freeze({inputs:{sabao:1,remedio:1}});
export const justiceServiceSpec=b=>funeralSpec(b)||(b?.type==='jail'?CUSTODY_SUPPLIES:null);
