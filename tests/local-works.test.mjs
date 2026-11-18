import assert from 'node:assert/strict';
import test from 'node:test';
import {IDBFactory,IDBObjectStore} from 'fake-indexeddb';
import {createLocalWorkStore} from '../lib/local-works.mjs';
const blob=new Blob(['finished-png-bytes'],{type:'image/png'});
const work=(id,extra={})=>({id,title:'생일 카드',kind:'image',blob,...extra});
test('finished media persists across app instances and repeated saves cannot overwrite it',async()=>{
 const indexedDB=new IDBFactory(),a=createLocalWorkStore({indexedDB,scope:'a'}),b=createLocalWorkStore({indexedDB,scope:'a'});
 try{await Promise.all([a.save(work('one')),b.save(work('one'))]);await b.save(work('one',{blob:new Blob(['replacement'],{type:'image/png'})}));assert.equal((await a.list()).length,1);assert.equal((await a.list())[0].blob,undefined);assert.equal(await (await b.get('one')).blob.text(),'finished-png-bytes');}finally{await a.close();await b.close();}
 const reloaded=createLocalWorkStore({indexedDB,scope:'a'});try{assert.equal(await(await reloaded.get('one')).blob.text(),'finished-png-bytes');}finally{await reloaded.close();}
});
test('profile and verification scopes cannot read, delete or clear another profile’s works',async()=>{
 const indexedDB=new IDBFactory(),a=createLocalWorkStore({indexedDB,scope:'owner'}),b=createLocalWorkStore({indexedDB,scope:'other'}),check=createLocalWorkStore({indexedDB,scope:'check:owner'});
 try{await a.save(work('same-id'));await b.save(work('same-id',{title:'다른 계정'}));await check.save(work('check'));assert.equal((await a.list()).length,1);assert.equal(await a.get('check'),null);await check.remove('same-id');assert(await a.get('same-id'));await a.clear();assert.equal(await a.get('same-id'),null);assert.equal((await b.get('same-id')).title,'다른 계정');assert(await check.get('check'));}finally{await a.close();await b.close();await check.close();}
});
test('invalid files fail and metadata rolls back when saving bytes fails',async()=>{
 const indexedDB=new IDBFactory(),a=createLocalWorkStore({indexedDB});const original=IDBObjectStore.prototype.add;
 try{for(const item of [work('../bad'),work('empty',{blob:new Blob([],{type:'image/png'})}),work('html',{blob:new Blob(['bad'],{type:'text/html'})}),work('big',{blob:new Blob([new Uint8Array(26*1024*1024)],{type:'image/png'})})])await assert.rejects(a.save(item));
 IDBObjectStore.prototype.add=function(...args){if(this.name==='files')throw new DOMException('full','QuotaExceededError');return original.apply(this,args);};await assert.rejects(a.save(work('rollback')));assert.equal(await a.get('rollback'),null);assert.equal((await a.list()).length,0);
 }finally{IDBObjectStore.prototype.add=original;await a.close();}
});
test('concurrent saves respect device-wide count and byte limits across profiles',async()=>{
 const indexedDB=new IDBFactory(),a=createLocalWorkStore({indexedDB,scope:'a'}),b=createLocalWorkStore({indexedDB,scope:'b'});
 try{for(let i=0;i<29;i++)await a.save(work('item-'+i));const last=await Promise.allSettled([a.save(work('last-a')),b.save(work('last-b'))]);assert.equal(last.filter(r=>r.status==='fulfilled').length,1);assert.equal((await a.list()).length+(await b.list()).length,30);}finally{await a.close();await b.close();}
 const bytes=createLocalWorkStore({indexedDB:new IDBFactory()});try{const big=new Blob([new Uint8Array(25*1024*1024)],{type:'image/png'});for(let i=0;i<4;i++)await bytes.save(work('big-'+i,{blob:big}));await assert.rejects(bytes.save(work('overflow')),/100MB/);}finally{await bytes.close();}
});
test('MOV and WebM are preserved; unavailable storage never reports success',async()=>{
 const a=createLocalWorkStore({indexedDB:new IDBFactory()});try{for(const mime of ['video/quicktime','video/mp4','video/webm;codecs=vp8,opus']){const id=mime.startsWith('video/quicktime')?'mov':mime.startsWith('video/mp4')?'mp4':'webm';await a.save(work(id,{kind:'video',blob:new Blob(['movie-bytes'],{type:mime})}));assert.equal((await a.get(id)).mime,mime);}}finally{await a.close();}
 await assert.rejects(createLocalWorkStore({indexedDB:null}).list(),/브라우저/);
});
