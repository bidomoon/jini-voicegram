export async function finalizeClosedAccount(store,uid){
 const ref=await store.get('providers/'+uid,{type:'json'});
 if(ref?.identityKey&&/^identities\/[a-f0-9]{64}$/.test(ref.identityKey))await store.delete(ref.identityKey);
 await store.delete('providers/'+uid);await store.delete('unlinked/'+uid);
}
export async function cleanAccounts(store,{deadline=Date.now()+5000,limit=100}={}){
 let checked=0,removed=0;
 const prefixes=['providers/','sessions/','oauth/'];
 const saved=await store.get('maintenance/account-cleanup',{type:'json'})||{prefix:0,after:''};
 let prefixIndex=Number.isInteger(saved.prefix)&&saved.prefix>=0&&saved.prefix<3?saved.prefix:0,after=typeof saved.after==='string'?saved.after:'';
 for(let cycle=0;cycle<prefixes.length;cycle++){
  const prefix=prefixes[prefixIndex],keys=[];for await(const page of store.list({prefix,paginate:true}))for(const {key}of page.blobs)if(key>after)keys.push(key);
  keys.sort();
  for(const key of keys){
   if(++checked>limit||Date.now()>deadline){await store.setJSON('maintenance/account-cleanup',{prefix:prefixIndex,after});return removed;}
   const record=await store.get(key,{type:'json'});after=key;if(!record)continue;
   if(prefix==='providers/'){const uid=key.slice(prefix.length);if(await store.get('closed/'+uid,{type:'json'})){await finalizeClosedAccount(store,uid);removed++;}}
   else if(record.exp<Date.now()||record.uid&&await store.get('closed/'+record.uid,{type:'json'})){await store.delete(key);removed++;}
  }
  prefixIndex=(prefixIndex+1)%prefixes.length;after='';
 }
 await store.setJSON('maintenance/account-cleanup',{prefix:prefixIndex,after:''});return removed;
}
