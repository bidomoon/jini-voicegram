import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {generateOnce,generationStatus} from '../netlify/functions/_shared/generation.mjs';
import {memoryStore} from './helpers/memory-store.mjs';
const auth={nonce:'test-owner',exp:Date.now()+3600000};
test('concurrent generation requests claim once; a response lost by the client remains retrievable',async()=>{
 const store=memoryStore(),id=randomUUID();let calls=0,finish;
 const provider=new Promise(r=>{finish=r;});
 const first=generateOnce(store,auth,id,'fingerprint',async()=>{calls++;await provider;return Response.json({image:'test-result'});});
 await new Promise(r=>setImmediate(r));
 const duplicate=await generateOnce(store,auth,id,'fingerprint',()=>{throw Error('must not repeat');});assert.equal(duplicate.status,202);finish();assert.equal((await first).status,200);
 assert.equal((await(await generationStatus(store,auth,id)).json()).image,'test-result');
 const repeat=await generateOnce(store,auth,id,'fingerprint',()=>{throw Error('must not repeat');});assert.equal((await repeat.json()).image,'test-result');assert.equal(calls,1);
 assert.equal((await generationStatus(store,{...auth,nonce:'other-owner'},id)).status,404);
 assert.equal((await generateOnce(store,auth,id,'changed-content',()=>{throw Error();})).status,409);
});
test('uncertain results and failed result storage never cause an automatic second charge',async()=>{
 for(const storageFailure of [false,true]){const store=memoryStore(),id=randomUUID();let calls=0;const base=store.setJSON.bind(store);store.setJSON=async(k,v,o)=>{if(storageFailure&&!o?.onlyIfNew)throw Error('storage unavailable');return base(k,v,o);};
 const run=async()=>{calls++;if(!storageFailure)throw Error('provider timeout');return Response.json({image:'test-result'});};
 await generateOnce(store,auth,id,'same',run);await generateOnce(store,auth,id,'same',run);assert.equal(calls,1);
 const res=await generationStatus(store,auth,id,Date.now()+100000);assert.equal(res.status,409);
 }
});
test('expired results and missing request IDs cannot call the provider',async()=>{
 const store=memoryStore(),id=randomUUID();const run=()=>Response.json({image:'test'});await generateOnce(store,auth,id,'same',run);assert.equal((await generationStatus(store,auth,id,auth.exp+1)).status,410);
 assert.equal((await generateOnce(store,auth,'','same',()=>{throw Error('no provider call');})).status,400);
});
test('cleanup removes only expired generation results, preserving live results and unrelated data',async()=>{
 const {cleanupGenerationResults}=await import('../netlify/functions/generation-cleanup.mjs');const store=memoryStore(),now=Date.now();await store.setJSON('requests/expired',{image:'old'},{metadata:{expires:now-1}});await store.setJSON('requests/live',{image:'keep'},{metadata:{expires:now+1000}});await store.setJSON('community',{posts:['keep']},{metadata:{expires:now-1}});
 assert.equal((await cleanupGenerationResults(store,now)).removed,1);assert.equal(await store.get('requests/expired'),null);assert.ok(await store.get('requests/live'));assert.ok(await store.get('community'));
});
