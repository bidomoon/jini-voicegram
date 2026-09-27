import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
const compiled=transformSync(readFileSync(new URL('../lib/creation-intent.ts',import.meta.url),'utf8'),{loader:'ts',format:'esm'}).code;
const {creationIntent}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
test('drawing requests are media intent, while diary entries and negatives stay text',()=>{
 for(const text of ['예쁜 고양이 그려줘','고양이를 그려 주세요','고양이 그려줄래?','고양이 그림 만들어줘','노을 사진 생성해줘'])assert.equal(creationIntent(text),'image',text);
 for(const text of ['고양이가 뛰는 영상 만들어줘','움직이는 강아지 그려줘'])assert.equal(creationIntent(text),'video',text);
 for(const text of ['오늘 고양이를 그렸어요.','아이와 그림 그리는 날','고양이 그리지 말고 글로 써줘','고양이를 만들지 마세요','행복한 하루를 만들어줘','그림을 그려달라는 말을 들었다'])assert.equal(creationIntent(text),null,text);
});
test('image adapter checks session and confirmation before calling the provider',async()=>{
 const priorEnv={...process.env},priorFetch=globalThis.fetch;
 process.env.VOICEGRAM_ACCESS_CODE='isolated-test-code-not-a-real-secret-123';process.env.OPENAI_API_KEY='test-only';process.env.MEDIA_ENABLED='true';
 const {default:studio}=await import('../netlify/functions/studio.mjs');
 const {sign}=await import('../netlify/functions/_shared/security.mjs');
 const payload=Buffer.from(JSON.stringify({exp:Date.now()+60000})).toString('base64url');
 const headers={origin:'https://test.example',cookie:`vg_session=${payload}.${sign(payload)}`};let calls=0;
 globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'https://api.openai.com/v1/images/generations');assert.equal(JSON.parse(options.body).prompt,'예쁜 고양이 그려줘');return Response.json({data:[{b64_json:'test-image-bytes'}]});};
 try{
  assert.equal((await(await studio(new Request('https://test.example/api/studio'))).json()).authenticated,false);
  assert.equal((await(await studio(new Request('https://test.example/api/studio',{headers}))).json()).authenticated,true);
  const form=()=>{const f=new FormData();f.set('prompt','예쁜 고양이 그려줘');f.set('kind','image');f.set('confirmed','true');return f;};
  assert.equal((await studio(new Request('https://test.example/api/studio',{method:'POST',body:form(),headers:{origin:headers.origin}}))).status,401);
  const unconfirmed=form();unconfirmed.delete('confirmed');assert.equal((await studio(new Request('https://test.example/api/studio',{method:'POST',body:unconfirmed,headers}))).status,400);assert.equal(calls,0);
  const result=await studio(new Request('https://test.example/api/studio',{method:'POST',body:form(),headers}));assert.equal(result.status,200);assert.equal((await result.json()).image,'data:image/jpeg;base64,test-image-bytes');assert.equal(calls,1);
 }finally{globalThis.fetch=priorFetch;for(const key of ['VOICEGRAM_ACCESS_CODE','OPENAI_API_KEY','MEDIA_ENABLED']){if(priorEnv[key]===undefined)delete process.env[key];else process.env[key]=priorEnv[key];}}
});
