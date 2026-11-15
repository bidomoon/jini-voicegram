import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

// Exercise the login boundary with durable-store semantics, without a browser or real user data.
globalThis.window=new EventTarget();
const markers=new Map(),drafts=new Map();
globalThis.sessionStorage={getItem:k=>markers.get(k)||null,setItem:(k,v)=>markers.set(k,v),removeItem:k=>markers.delete(k)};
globalThis.__drafts=drafts;
const module=await build({entryPoints:[new URL('../lib/login-draft.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',plugins:[{name:'draft-store',setup(b){b.onResolve({filter:/^\.\/story-draft$/},()=>({path:'store',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:`export const readDraft=async s=>structuredClone(globalThis.__drafts.get(s));export const writeDraft=async(s,d)=>{if(globalThis.__saveFailure)throw Error('Device storage full');globalThis.__drafts.set(s,structuredClone(d));};export const validDraft=d=>d?.version===1;export const hasDraftContent=d=>!!(d.caption||d.file);`,loader:'js'}));}}]});
const {prepareLogin,preserveLoginDraft,resumeLoginDraft,clearLoginDraft,waitForDraftSave,stashSpaceDraft,activateSpaceDraft}=await import('data:text/javascript;base64,'+Buffer.from(module.outputFiles[0].text).toString('base64'));
const draft=()=>({version:1,postId:'same-post',caption:'말로 작성한 이야기',file:new Blob(['original video bytes'],{type:'video/mp4'}),step:2,videoMode:'upload'});
test('login waits for the entire video draft; resumed work keeps its source scope and another account draft intact',async()=>{
 const d=draft();drafts.set('account-a',{caption:'기존 계정 초안'});
 const preserve=e=>waitForDraftSave(e,preserveLoginDraft('guest',d));window.addEventListener('voicegram-before-login',preserve);
 await prepareLogin();window.removeEventListener('voicegram-before-login',preserve);
 const resumed=await resumeLoginDraft();assert.equal(resumed.scope,'guest');assert.equal(resumed.draft.postId,'same-post');assert.equal(resumed.draft.step,2);assert.equal(await resumed.draft.file.text(),'original video bytes');assert.equal(resumed.draft.file.type,'video/mp4');assert.equal(drafts.get('account-a').caption,'기존 계정 초안');
 // A cancelled React effect may read the pointer; consumption only happens when the component restores it.
 assert.equal((await resumeLoginDraft()).scope,'guest');clearLoginDraft();assert.equal(await resumeLoginDraft(),null);
});
test('storage failure blocks navigation instead of dropping an attachment; expired and replaced drafts do not resume',async()=>{
 globalThis.__saveFailure=true;const preserve=e=>waitForDraftSave(e,preserveLoginDraft('guest',draft()));window.addEventListener('voicegram-before-login',preserve);
 await assert.rejects(prepareLogin(),/Device storage full/);window.removeEventListener('voicegram-before-login',preserve);globalThis.__saveFailure=false;assert.equal(markers.size,0);
 await preserveLoginDraft('guest',draft());drafts.set('guest',{...draft(),postId:'newer-post'});assert.equal(await resumeLoginDraft(),null);clearLoginDraft();
 markers.set('vg-login-draft-v2',JSON.stringify({scope:'guest',expires:Date.now()-1}));assert.equal(await resumeLoginDraft(),null);assert.equal(markers.size,0);
 markers.set('vg-login-draft-v2','null');assert.equal(await resumeLoginDraft(),null);
});
test('switching verification spaces preserves each complete draft and never resumes a different account’s pointer',async()=>{
 clearLoginDraft();const real={...draft(),postId:'real-post'},check={...draft(),postId:'check-post',caption:'점검용 다른 내용',file:new Blob(['verification bytes'],{type:'video/mp4'})};
 await preserveLoginDraft('guest',real);stashSpaceDraft('production','owner');activateSpaceDraft('verification','owner');assert.equal(await resumeLoginDraft(),null);
 await preserveLoginDraft('check:owner',check);stashSpaceDraft('verification','owner');activateSpaceDraft('production','owner');const restored=await resumeLoginDraft();assert.equal(restored.scope,'guest');assert.equal(restored.draft.postId,'real-post');assert.equal(await restored.draft.file.text(),'original video bytes');clearLoginDraft();
 activateSpaceDraft('verification','owner');assert.equal((await resumeLoginDraft()).draft.caption,'점검용 다른 내용');activateSpaceDraft('production','another-owner');assert.equal(await resumeLoginDraft(),null);clearLoginDraft();
});
