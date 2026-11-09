const DATABASE = 'suburban-worlds';
const STORE = 'saves';
const SAVE_ID = 'current';

function openDatabase(){
  if(!globalThis.indexedDB)return Promise.reject(new Error('Este navegador não oferece armazenamento durável para o mundo.'));
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DATABASE,1);
    request.onupgradeneeded=()=>request.result.createObjectStore(STORE,{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('Não foi possível abrir o armazenamento do mundo.'));
  });
}

async function transact(mode,operation){
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);
    let result;
    try{result=operation(store);}catch(error){db.close();reject(error);return;}
    tx.oncomplete=()=>{db.close();resolve(result?.result);};
    tx.onerror=tx.onabort=()=>{const error=tx.error||result?.error||new Error('Falha ao acessar o salvamento do mundo.');db.close();reject(error);};
  });
}

export function saveWorldRecord(record){
  if(!record||record.version!==1||!Array.isArray(record.cities))return Promise.reject(new TypeError('Formato de salvamento do mundo inválido.'));
  return transact('readwrite',store=>store.put({...record,id:SAVE_ID,savedAt:Date.now()}));
}
export async function loadWorldRecord(){
  const record=await transact('readonly',store=>store.get(SAVE_ID));
  if(!record)return null;
  if(record.version!==1||!Array.isArray(record.cities)||!record.coordinator)throw new TypeError('Versão de salvamento do mundo incompatível.');
  return record;
}
