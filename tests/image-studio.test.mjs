import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {randomUUID} from 'node:crypto';
import {memoryStore} from './helpers/memory-store.mjs';
const code=transformSync(readFileSync(new URL('../lib/image-studio.ts',import.meta.url),'utf8'),{loader:'ts',format:'esm'}).code;
const {imageSamples,imageInstruction,validImageChoices}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('numbered sample, caption and overlay commands are explicit; ordinary stories stay literal',()=>{
 assert.deepEqual(imageInstruction('1번 이미지가 좋다'),{action:'pick',index:0});
 assert.deepEqual(imageInstruction('삼 번 이미지 적용해줘'),{action:'pick',index:2});
 assert.deepEqual(imageInstruction('1번 이미지 적용하고 문구는 생일 축하해로 넣어줘'),{action:'pick',index:0,overlay:'생일 축하해'});
 assert.deepEqual(imageInstruction('2번 문구 적용해줘'),{action:'caption',index:1});
 assert.deepEqual(imageInstruction('문구는 생일 축하해로 넣어줘'),{action:'overlay',text:'생일 축하해'});
 assert.deepEqual(imageInstruction('문구는 “히어로”로 넣어줘'),{action:'overlay',text:'히어로'});
 assert.deepEqual(imageInstruction('대상을 사람으로 바꿔줘'),{action:'edit',prompt:'대상을 사람으로 바꿔줘'});
 for(const value of ['“1번 이미지 적용해줘”','친구가 1번 이미지가 좋다고 했어요','문구는 생일 축하해로 넣어줘라는 말을 들었다','오늘 2번 문구를 읽었어요','게시 확정'])assert.equal(imageInstruction(value),null,value);
 assert.equal(imageSamples.length,4);for(const sample of imageSamples){assert.ok(sample.src.startsWith('/visuals/'));assert.ok(sample.caption&&sample.prompt);}
});
test('only bounded local image results restore; old choices remain independently selectable',()=>{
 const choices=Array.from({length:5},(_,i)=>({id:'result-'+i,url:'data:image/jpeg;base64,Ynl0ZXM=',prompt:'scene '+i,created:i}));
 assert.deepEqual(validImageChoices(choices).map(x=>x.id),['result-2','result-3','result-4']);
 assert.equal(validImageChoices([{...choices[0],url:'https://evil.example/image.png'},{...choices[0],id:'../bad'},{...choices[0],url:'data:text/html;base64,YQ=='}]).length,0);
 assert.equal(validImageChoices(null).length,0);
});
test('OpenAI image adapter generates one economical image and sends actual references only to edits',async()=>{
 const {imageProviders}=await import('../netlify/functions/_shared/image-provider.mjs');
 const calls=[];const fetcher=async(url,options)=>{calls.push({url,options});return Response.json({data:[{b64_json:'Ynl0ZXM='}]});};
 const output=await imageProviders.openai.generate({prompt:'a quiet scene',ratio:'1:1',fetcher});assert.equal(output.image,'data:image/jpeg;base64,Ynl0ZXM=');
 const params=JSON.parse(calls[0].options.body);assert.equal(params.n,1);assert.equal(params.quality,'low');assert.equal(params.size,'1024x1024');assert.match(calls[0].url,/images\/generations$/);
 const photo=new Blob(['actual reference bytes'],{type:'image/png'});await imageProviders.openai.generate({prompt:'change subject',ratio:'4:5',photo,fetcher});assert.match(calls[1].url,/images\/edits$/);assert.equal(await calls[1].options.body.get('image').text(),'actual reference bytes');assert.equal(calls[1].options.body.get('n'),'1');
});
test('server-owned image adapters preserve confirmation, idempotency and model-bound request identity',async()=>{
 const env={...process.env};process.env.VOICEGRAM_ACCESS_CODE='test-only-12345678901234567890';delete process.env.VOICEGRAM_IMAGE_PROVIDER;
 const {sign}=await import('../netlify/functions/_shared/security.mjs');const {createStudioHandler}=await import('../netlify/functions/studio.mjs');
 const payload=Buffer.from(JSON.stringify({exp:Date.now()+60000})).toString('base64url'),headers={origin:'https://test.example',cookie:`vg_session=${payload}.${sign(payload)}`};const id=randomUUID(),store=memoryStore();let calls=0,model='model-a';
 const adapter={ready:()=>true,model:()=>model,generate:async args=>{calls++;assert.equal(args.prompt,'scene');return {image:'data:image/jpeg;base64,Ynl0ZXM='};}};
 const handler=createStudioHandler({store:()=>store,providers:{openai:adapter}});
 const form=(confirmed=true)=>{const f=new FormData();f.set('requestId',id);f.set('kind','image');f.set('prompt','scene');f.set('provider','untrusted');if(confirmed)f.set('confirmed','true');return f;};
 const req=f=>new Request('https://test.example/api/studio',{method:'POST',headers,body:f});
 try{assert.equal((await handler(req(form(false)))).status,400);assert.equal(calls,0);assert.equal((await handler(req(form()))).status,200);assert.equal((await handler(req(form()))).status,200);assert.equal(calls,1);model='model-b';assert.equal((await handler(req(form()))).status,409);assert.equal(calls,1);process.env.VOICEGRAM_IMAGE_PROVIDER='unregistered';assert.equal((await handler(req(form()))).status,503);assert.equal(calls,1);}
 finally{for(const key of ['VOICEGRAM_ACCESS_CODE','VOICEGRAM_IMAGE_PROVIDER']){if(env[key]===undefined)delete process.env[key];else process.env[key]=env[key];}}
});
