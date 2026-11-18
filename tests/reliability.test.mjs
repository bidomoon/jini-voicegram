import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';

const load=async name=>import('data:text/javascript;base64,'+Buffer.from(transformSync(readFileSync(new URL('../lib/'+name,import.meta.url),'utf8'),{loader:'ts',format:'esm'}).code).toString('base64'));
const {createAutosave}=await load('autosave.ts');
const {requestJSON,requestJSONResponse,requestBlob,RequestError}=await load('http.ts');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};

test('leaving before debounce flushes the latest edit, including an intentionally emptied story',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const writes=[],states=[],save=createAutosave(async value=>writes.push(value),value=>states.push(value));
 save.stage({scope:'own',caption:'old story'});save.stage({scope:'own',caption:''});
 assert.deepEqual(writes,[]);assert.equal(save.pending(),true);
 await save.flush();assert.deepEqual(writes,[{scope:'own',caption:''}]);assert.equal(save.pending(),false);assert.equal(states.at(-1),'saved');
 t.mock.timers.tick(1000);await save.settle();assert.equal(writes.length,1);
});

test('old save acknowledgements cannot mark a newer edit as saved; writes stay in order',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const first=deferred(),second=deferred(),started=deferred(),writes=[],states=[],save=createAutosave(async value=>{writes.push(value);if(writes.length===1){started.resolve();await first.promise;}else await second.promise;},state=>states.push(state));
 const earlier=save.save({scope:'first-user',caption:'first'});await started.promise;
 save.stage({scope:'second-user',caption:'newest'});const latest=save.flush();
 assert.equal(writes.length,1);first.resolve();await earlier;
 assert.equal(states.at(-1),'pending');second.resolve();await latest;
 assert.deepEqual(writes.map(value=>value.scope),['first-user','second-user']);assert.equal(states.at(-1),'saved');
});

test('storage failure remains dirty and can be explicitly retried without losing the draft',async()=>{
 let fail=true;const writes=[],states=[],save=createAutosave(async value=>{if(fail)throw Error('quota');writes.push(value);},state=>states.push(state));
 await assert.rejects(save.save('keep my work'),/quota/);assert.equal(save.pending(),true);assert.equal(states.at(-1),'failed');
 fail=false;await save.flush();assert.deepEqual(writes,['keep my work']);assert.equal(save.pending(),false);assert.equal(states.at(-1),'saved');
});

test('publishing cancels a pending debounce, and unmount flushes without late UI updates',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const writes=[],states=[],save=createAutosave(async value=>writes.push(value),state=>states.push(state));
 save.stage('published work');await save.flush();save.cancelPending();t.mock.timers.tick(1000);await save.settle();assert.equal(writes.length,1);
 save.stage('last keystroke');const closing=save.flush();save.setNotifications(false);const count=states.length;await closing;
 assert.deepEqual(writes,['published work','last keystroke']);assert.equal(states.length,count);
});

test('a stalled post times out once, aborts transport and never automatically replays the write',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let calls=0,aborted=false;
 const posting=requestJSON('/post',{method:'POST'},{timeoutMs:50,request:async(_,options)=>{calls++;options.signal.addEventListener('abort',()=>{aborted=true;});return new Promise(()=>{});}});
 const rejected=assert.rejects(posting,error=>error instanceof RequestError&&error.code==='REQUEST_TIMEOUT');
 t.mock.timers.tick(50);await rejected;assert.equal(calls,1);assert.equal(aborted,true);
});

test('the deadline also bounds a response body that never finishes',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const pending=requestJSON('/feed',{}, {timeoutMs:50,request:async()=>({ok:true,json:()=>new Promise(()=>{})})});
 const rejected=assert.rejects(pending,error=>error.code==='REQUEST_TIMEOUT');await Promise.resolve();t.mock.timers.tick(50);await rejected;
});

test('expired authentication and invalid proxy responses retain HTTP status for safe recovery',async()=>{
 await assert.rejects(requestJSON('/feed',{}, {request:async()=>Response.json({error:'login expired'},{status:401})}),error=>error.status===401&&error.message==='login expired');
 await assert.rejects(requestJSON('/feed',{}, {request:async()=>new Response('<html>login</html>',{status:403})}),error=>error.status===403&&error.code==='INVALID_RESPONSE');
 await assert.rejects(requestJSON('/feed',{}, {request:async()=>new Response('<html>not JSON</html>')}),error=>error.status===undefined&&error.code==='INVALID_RESPONSE');
 assert.deepEqual(await requestJSON('/feed',{}, {request:async()=>Response.json({posts:[]})}),{posts:[]});
});

test('caller cancellation stops a pending body and a pre-cancelled request never starts',async()=>{
 const controller=new AbortController();let calls=0;
 const pending=requestJSON('/feed',{signal:controller.signal},{request:async()=>{calls++;return {ok:true,json:()=>new Promise(()=>{})};}});
 const rejected=assert.rejects(pending,error=>error.name==='AbortError');controller.abort();await rejected;
 await assert.rejects(requestJSON('/feed',{signal:controller.signal},{request:async()=>{calls++;return Response.json({});}}),error=>error.name==='AbortError');
 assert.equal(calls,1);
});

test('AI response recovery keeps provider state and request identity without starting another generation',async()=>{
 let calls=0;
 const {response,data}=await requestJSONResponse('/studio',{method:'POST'},{request:async()=>{calls++;return Response.json({state:'unknown',requestId:'original-request',error:'check existing result'},{status:502});}});
 assert.equal(response.status,502);assert.equal(data.state,'unknown');assert.equal(data.requestId,'original-request');assert.equal(calls,1);
});

test('sample and completed media downloads are bounded too, preserving successful file bytes',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const stalled=requestBlob('/sample',{}, {timeoutMs:50,request:async()=>({ok:true,blob:()=>new Promise(()=>{})})});
 const rejected=assert.rejects(stalled,error=>error.code==='REQUEST_TIMEOUT');await Promise.resolve();t.mock.timers.tick(50);await rejected;
 const result=await requestBlob('/image',{}, {request:async()=>new Response('actual image bytes',{headers:{'content-type':'image/png'}})});
 assert.equal(result.type,'image/png');assert.equal(await result.text(),'actual image bytes');
});
