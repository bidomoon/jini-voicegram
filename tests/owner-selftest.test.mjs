import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {memoryStore} from './helpers/memory-store.mjs';
import {createAuthHandler} from '../netlify/functions/auth.mjs';
import {accountSession} from '../netlify/functions/_shared/accounts.mjs';
import {ownerPolicy} from '../netlify/functions/_shared/operator-policy.mjs';
import {createSocialHandler} from '../netlify/functions/social.mjs';
import {createSelftestHandler} from '../netlify/functions/selftest.mjs';
import {createPrivacyHandler} from '../netlify/functions/privacy.mjs';
process.env.SOCIAL_SESSION_SECRET='test-owner-device-secret-not-an-actual-credential';
process.env.VOICEGRAM_ACCESS_CODE='test-legacy-gate-not-an-actual-invitation';
const origin='https://app.example',context=()=>({site:{id:ownerPolicy.siteId},user:{id:ownerPolicy.ownerId,expiresAt:new Date(Date.now()+3600000)}});
const request=(path,{cookie,method='GET',body,headers={}}={})=>new Request(origin+path,{method,headers:{origin,...(cookie?{cookie}:{}),...headers},...(body?{body}:{} )});
async function setup(){const accounts=memoryStore(),production=memoryStore(),sandbox=memoryStore(),ctx=context(),auth=createAuthHandler({storeFactory:()=>accounts,socialFactory:()=>production,config:()=>({origin,ready:false})});const r=await auth(request('/api/auth?action=owner',{method:'POST'}),ctx);assert.equal(r.status,200);const cookie=r.headers.getSetCookie()[0].split(';')[0];return {accounts,production,sandbox,ctx,auth,cookie};}
test('existing verified owner starts a distinct community profile without receiving a paid-AI tester session',async()=>{
 const {accounts,production,ctx,auth,cookie}=await setup();const status=await(await auth(request('/api/auth',{cookie}),ctx)).json();assert.equal(status.provider,'netlify');assert.equal(status.authenticated,true);assert.equal(status.ownerReady,true);assert.equal(status.canModerate,true);assert.equal((await production.get('community')).profiles[status.uid].name,'지니팀 운영자');assert.ok(!cookie.includes('vg_session'));assert.ok(await accountSession(request('/',{cookie}),accounts,Date.now(),ctx));
 const second=await auth(request('/api/auth?action=owner',{method:'POST'}),ctx);const c2=second.headers.getSetCookie()[0].split(';')[0];assert.equal((await accountSession(request('/',{cookie:c2}),accounts,Date.now(),ctx)).uid,status.uid);
});
test('owner sessions cannot be replayed without verified context, at another site, by another person, after expiry or after role revocation',async()=>{
 const {accounts,ctx,cookie}=await setup();const req=request('/',{cookie});
 for(const c of [undefined,{...ctx,user:{...ctx.user,id:'another-person'}},{...ctx,site:{id:'copied-site'}}])assert.equal(await accountSession(req,accounts,Date.now(),c),null);
 assert.equal(await accountSession(req,accounts,Date.now()+2*3600000,ctx),null);process.env.VOICEGRAM_MODERATOR_NETLIFY_IDS='';assert.equal(await accountSession(req,accounts,Date.now(),ctx),null);delete process.env.VOICEGRAM_MODERATOR_NETLIFY_IDS;
});
test('owner entry rejects forged headers, cross-origin and expired context before creating profiles',async()=>{
 const accounts=memoryStore(),production=memoryStore(),auth=createAuthHandler({storeFactory:()=>accounts,socialFactory:()=>production,config:()=>({origin,ready:false})});
 assert.equal((await auth(request('/api/auth?action=owner',{method:'POST',headers:{'x-nf-user':ownerPolicy.ownerId}}))).status,403);
 assert.equal((await auth(request('/api/auth?action=owner',{method:'POST',headers:{origin:'https://evil.example'}}),context())).status,403);
 const expired=context();expired.user.expiresAt=new Date(1);assert.equal((await auth(request('/api/auth?action=owner',{method:'POST'}),expired)).status,401);assert.equal(await production.get('community'),null);
});
test('sandbox publication is persistent and isolated; production cannot serve its media and untrusted callers cannot enter',async()=>{
 const {accounts,production,sandbox,ctx,cookie}=await setup(),handler=createSelftestHandler({store:()=>sandbox,accounts:()=>accounts}),real=createSocialHandler({store:()=>production,accounts:()=>accounts}),id=randomUUID(),form=new FormData();form.set('id',id);form.set('caption','실사용 점검 전용 글');form.set('file',new Blob([new Uint8Array([255,216,255,224,0,0,0,0])],{type:'image/jpeg'}),'check.jpg');
 assert.equal((await handler(request('/api/selftest',{cookie}))).status,403);const r=await handler(request('/api/selftest',{cookie,method:'POST',body:form}),ctx);assert.equal(r.status,200);const d=await r.json();assert.equal(d.posts[0].media.url,'/api/selftest?media='+id);assert.equal(d.authProvider,'netlify');assert.equal((await production.get('community')).posts.length,0);
 assert.equal((await handler(request('/api/selftest?media='+id,{cookie}),ctx)).status,200);assert.equal((await real(request('/api/social?media='+id,{cookie}),ctx)).status,404);assert.equal((await real(request('/api/social',{cookie}),ctx)).status,200);
 const again=await handler(request('/api/selftest',{cookie}),ctx);assert.equal((await again.json()).posts[0].id,id);
});
test('owner can export and close only the app profile; closing revokes all app sessions without calling Kakao or changing the provider account',async()=>{
 const {accounts,production,ctx,cookie,auth}=await setup(),privacy=createPrivacyHandler({socialFactory:()=>production,accountsFactory:()=>accounts,request:()=>{throw Error('No provider request is permitted');}});
 assert.equal((await(await privacy(request('/api/privacy?status=1',{cookie}),ctx)).json()).canDelete,true);assert.equal((await privacy(request('/api/privacy',{cookie}),ctx)).status,200);
 const r=await privacy(request('/api/privacy',{cookie,method:'POST',body:JSON.stringify({action:'closeAccount',confirm:'내 계정 삭제',requestId:randomUUID()})}),ctx);assert.equal(r.status,200);assert.equal(await accountSession(request('/',{cookie}),accounts,Date.now(),ctx),null);
 const fresh=await auth(request('/api/auth?action=owner',{method:'POST'}),ctx);assert.equal(fresh.status,200);
});
test('app logout invalidates the app session while the verified owner remains eligible to start again',async()=>{
 const {accounts,ctx,cookie,auth}=await setup();assert.equal((await auth(request('/api/auth?action=logout',{cookie,method:'POST'}),ctx)).status,200);assert.equal(await accountSession(request('/',{cookie}),accounts,Date.now(),ctx),null);const state=await(await auth(request('/api/auth'),ctx)).json();assert.equal(state.authenticated,false);assert.equal(state.ownerReady,true);
});
test('closing the app profile also closes verification records and media instead of leaving another active copy',async()=>{
 const {accounts,production,sandbox,ctx,cookie}=await setup(),checks=createSelftestHandler({store:()=>sandbox,accounts:()=>accounts}),form=new FormData(),id=randomUUID();form.set('id',id);form.set('caption','점검 공간 개인 기록');form.set('file',new Blob([new Uint8Array([255,216,255,224])],{type:'image/jpeg'}),'check.jpg');await checks(request('/api/selftest',{cookie,method:'POST',body:form}),ctx);
 const privacy=createPrivacyHandler({socialFactory:()=>production,secondaryFactory:()=>sandbox,accountsFactory:()=>accounts});const exported=await(await privacy(request('/api/privacy',{cookie}),ctx)).json();assert.equal(exported.verificationRecords.posts[0].id,id);
 const r=await privacy(request('/api/privacy',{cookie,method:'POST',body:JSON.stringify({action:'closeAccount',confirm:'내 계정 삭제',requestId:randomUUID()})}),ctx);assert.equal(r.status,200);assert.equal((await sandbox.get('community')).posts.length,0);assert.equal(await sandbox.get('media/'+id),null);
});
