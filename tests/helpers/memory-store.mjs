/** In-memory test double with the same atomic conditional-write contract. */
export function memoryStore(){const values=new Map();let revision=0;return {
 async get(key,{type='json'}={}){const v=values.get(key);return v?structuredClone(v.data):null;},
 async getWithMetadata(key){const v=values.get(key);return v?structuredClone(v):null;},
 async getMetadata(key){const v=values.get(key);return v?{etag:v.etag,metadata:structuredClone(v.metadata)}:null;},
 async setJSON(key,data,options={}){const old=values.get(key);if(options.onlyIfNew&&old||options.onlyIfMatch&&old?.etag!==options.onlyIfMatch)return {modified:false};values.set(key,{data:structuredClone(data),etag:String(++revision),metadata:options.metadata||{}});return {modified:true};},
 async set(key,data,options={}){return this.setJSON(key,data,options);},
 async delete(key){values.delete(key);},
 list(options={}){const page={blobs:[...values.keys()].filter(key=>!options.prefix||key.startsWith(options.prefix)).map(key=>({key}))};return options.paginate?(async function*(){yield page;})():Promise.resolve(page);}
};}
