import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHmac,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {memoryStore} from './helpers/memory-store.mjs';
import {empty,mutate,visible,update} from '../netlify/functions/_shared/social-core.mjs';
import {ownRecords,purgeClosedMedia} from '../netlify/functions/_shared/privacy.mjs';
import {cleanAccounts} from '../netlify/functions/_shared/account-lifecycle.mjs';
import {createPrivacyHandler} from '../netlify/functions/privacy.mjs';
import {createModerationHandler} from '../netlify/functions/moderation.mjs';
import {createSocialHandler} from '../netlify/functions/social.mjs';
import {providerAccount,accountSession,hash,opaque} from '../netlify/functions/_shared/accounts.mjs';
import {prepareUpload,uploadPart,finishUpload,cleanUploads} from '../netlify/functions/_shared/social-upload.mjs';
import {sign} from '../netlify/functions/_shared/security.mjs';
import {moderatorIdentity} from '../netlify/functions/_shared/community-access.mjs';
import {ownerPolicy} from '../netlify/functions/_shared/operator-policy.mjs';
process.env.VOICEGRAM_ACCESS_CODE='test-only-community-invitation-not-a-secret';
process.env.SOCIAL_SESSION_SECRET='test-only-community-session-secret-not-production';
const origin='https://app.example';
function cookie(uid){const payload=Buffer.from(JSON.stringify({exp:Date.now()+3600000})).toString('base64url'),exp=Date.now()+3600000,sig=createHmac('sha256',process.env.SOCIAL_SESSION_SECRET).update('person:'+uid+'.'+exp).digest('hex');return `vg_session=${payload}.${sign(payload)}; vg_person=${uid}.${exp}.${sig}`;}
const req=(path,{uid,token,body,source=origin,headers={},method=body?'POST':'GET'}={})=>new Request(origin+path,{method,headers:{origin:source,...(uid?{cookie:cookie(uid)}:token?{cookie:'vg_account='+token}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
function fixture(){const s=empty(),a=randomUUID(),b=randomUUID(),pa=randomUUID(),pb=randomUUID();mutate(s,a,{action:'publish',id:pa,caption:'A의 기록',media:{type:'video/mp4'}});mutate(s,b,{action:'publish',id:pb,caption:'B의 비공개 신고 테스트'});mutate(s,a,{action:'comment',id:pb,body:'A의 댓글',requestId:randomUUID()});mutate(s,b,{action:'comment',id:pa,body:'B의 댓글',requestId:randomUUID()});mutate(s,b,{action:'report',id:pa,reason:'신고자 B만 볼 내용'});mutate(s,a,{action:'follow',id:b,value:true});return {s,a,b,pa,pb};}
test('personal export contains only the owner’s records, excludes other reports, and never returns account tokens',()=>{
 const {s,a,b}=fixture(),d=ownRecords(s,a);assert.equal(d.posts.length,1);assert.equal(d.comments.length,1);assert.equal(d.comments[0].user,a);assert.equal(d.reports.length,0);assert.equal(d.following[0].target,b);assert.ok(!JSON.stringify(d).includes('신고자 B만 볼 내용'));assert.equal(d.profiles,undefined);assert.equal(d.sessions,undefined);
});
test('account closure atomically removes content and relationships and prevents resurrection',async()=>{
 const {s,a,b,pa,pb}=fixture(),store=memoryStore();await store.setJSON('community',s);await Promise.allSettled([update(store,a,{action:'closeAccount',confirm:'내 계정 삭제',requestId:randomUUID()}),update(store,a,{action:'profile',name:'동시 요청'})]);
 const result=await store.get('community');assert.ok(result.closed[a]);assert.equal(result.profiles[a],undefined);assert.equal(result.posts.length,1);assert.equal(result.posts[0].id,pb);assert.equal(result.comments.length,0);assert.equal(result.follows.length,0);assert.equal(result.reports.length,0);assert.ok(result.closed[a].media.includes(pa));assert.throws(()=>mutate(result,a,{action:'profile',name:'부활'}),e=>e.status===410);assert.equal(visible(result,b).posts.length,1);
});
test('privacy endpoint enforces origin and explicit confirmation, deletes only the caller, and retries safely',async()=>{
 const {s,a,b,pa}=fixture(),store=memoryStore(),accounts=memoryStore();await store.setJSON('community',s);await store.set('media/'+pa,new Uint8Array([1]).buffer,{metadata:{user:a,type:'video/mp4'}});await store.set('media/unrelated',new Uint8Array([9]).buffer);
 const handler=createPrivacyHandler({socialFactory:()=>store,accountsFactory:()=>accounts}),close={action:'closeAccount',confirm:'내 계정 삭제',requestId:randomUUID(),uid:b};
 assert.equal((await handler(req('/api/privacy'))).status,401);assert.equal((await handler(req('/api/privacy',{uid:a,body:close,source:'https://evil.example'}))).status,403);assert.equal((await handler(req('/api/privacy',{uid:a,body:{...close,confirm:'삭제'}}))).status,400);const beforeSocial=createSocialHandler({store:()=>store});assert.equal((await beforeSocial(req('/api/social',{uid:a,body:close}))).status,400);assert.ok((await store.get('community')).profiles[a]);
 const exported=await handler(req('/api/privacy',{uid:a}));assert.match(exported.headers.get('content-disposition'),/attachment/);assert.equal((await exported.json()).profile.id,a);
 assert.equal((await handler(req('/api/privacy',{uid:a,body:close}))).status,200);assert.equal((await handler(req('/api/privacy',{uid:a,body:close}))).status,200);assert.equal(await store.get('media/'+pa),null);assert.ok(await store.get('media/unrelated'));assert.ok((await store.get('community')).profiles[b]);
 const social=createSocialHandler({store:()=>store});assert.equal((await social(req('/api/social',{uid:a}))).status,410);assert.equal((await social(req('/api/social?media='+pa,{uid:b}))).status,404);
});
test('a failed media purge remains queued, inaccessible, and recoverable by the scheduled cleaner',async()=>{
 const {s,a,pa}=fixture(),store=memoryStore();await store.setJSON('community',s);await store.set('media/'+pa,new Uint8Array([1]).buffer,{metadata:{user:a,type:'video/mp4'}});const remove=store.delete.bind(store);let failed=true;store.delete=async key=>{if(failed&&key==='media/'+pa)throw Error('temporary failure');return remove(key);};
 const handler=createPrivacyHandler({socialFactory:()=>store,accountsFactory:memoryStore}),r=await handler(req('/api/privacy',{uid:a,body:{action:'closeAccount',confirm:'내 계정 삭제',requestId:randomUUID()}}));assert.equal((await r.json()).mediaCleanupPending,true);assert.ok((await store.get('community')).closed[a].media.length);failed=false;assert.equal(await purgeClosedMedia(store),1);assert.equal(await store.get('media/'+pa),null);assert.equal((await store.get('community')).closed[a].media.length,0);
});
test('delayed account cleanup preserves media if the object now belongs to somebody else',async()=>{
 const store=memoryStore(),s=empty(),id=randomUUID();s.closed={a:{at:1,media:[id]}};await store.setJSON('community',s);await store.set('media/'+id,new Uint8Array([9]).buffer,{metadata:{user:'b'}});await purgeClosedMedia(store);assert.ok(await store.get('media/'+id));assert.equal((await store.get('community')).closed.a.media.length,0);
});
async function kakaoFixture(){const store=memoryStore(),accounts=memoryStore(),account=await providerAccount(accounts,'app-1','123456'),token=opaque(),s=empty();mutate(s,account.uid,{action:'profile',name:'카카오 이웃'});await store.setJSON('community',s);await accounts.setJSON('sessions/'+hash(token),{uid:account.uid,provider:'kakao',exp:Date.now()+3600000});return {store,accounts,account,token};}
test('Kakao deletion unlinks only the server-owned provider ID, revokes all sessions, and removes provider identifiers',async()=>{
 const {store,accounts,account,token}=await kakaoFixture();let calls=0;const handler=createPrivacyHandler({socialFactory:()=>store,accountsFactory:()=>accounts,read:k=>k==='KAKAO_ADMIN_KEY'?'test-admin-key':undefined,request:async(url,options)=>{calls++;assert.equal(url,'https://kapi.kakao.com/v1/user/unlink');assert.equal(options.body.get('target_id'),'123456');return Response.json({id:123456});}});
 const result=await handler(req('/api/privacy',{token,body:{action:'closeAccount',confirm:'내 계정 삭제',requestId:randomUUID(),providerId:'another-user'}}));assert.equal(result.status,200);assert.equal(calls,1);assert.equal(await accountSession(req('/',{token}),accounts),null);assert.equal(await accounts.get('providers/'+account.uid),null);assert.notEqual((await providerAccount(accounts,'app-1','123456')).uid,account.uid);
});
test('missing or uncertain provider unlink never reports deletion or removes the community profile',async()=>{
 for(const mode of ['missing','wrong-response','timeout']){const {store,accounts,account,token}=await kakaoFixture(),handler=createPrivacyHandler({socialFactory:()=>store,accountsFactory:()=>accounts,read:()=>mode==='missing'?undefined:'test-key',request:async()=>{if(mode==='timeout')throw Error('timeout');return Response.json({id:999});}}),r=await handler(req('/api/privacy',{token,body:{action:'closeAccount',confirm:'내 계정 삭제',requestId:randomUUID()}}));assert.ok(r.status>=500);assert.ok((await store.get('community')).profiles[account.uid]);assert.equal((await store.get('community')).closed,undefined);}
});
test('moderation rejects spoofed identity and unlisted team members; hiding protects the feed and media while preserving audit',async()=>{
 const {s,a,b,pa}=fixture(),store=memoryStore();await store.setJSON('community',s);await store.set('media/'+pa,new Uint8Array([1,2,3]).buffer,{metadata:{type:'video/mp4',user:a}});const id=s.reports[0].id,handler=createModerationHandler({storeFactory:()=>store,read:k=>k==='VOICEGRAM_MODERATOR_NETLIFY_IDS'?'owner-id':undefined}),context={user:{id:'owner-id'}},body={id,action:'hide',note:'운영 원칙 위반을 확인함'};
 assert.equal((await handler(req('/api/moderation',{uid:a,headers:{'x-nf-user':'owner-id'}}))).status,403);assert.equal((await handler(req('/api/moderation'),{user:{id:'other-id'}})).status,403);assert.equal((await handler(req('/api/moderation',{body,source:'https://evil.example'}),context)).status,403);
 assert.equal((await handler(req('/api/moderation',{body:{...body,note:''}}),context)).status,400);assert.equal((await handler(req('/api/moderation',{body}),context)).status,200);const after=await store.get('community');assert.equal(visible(after,b).posts.some(p=>p.id===pa),false);assert.equal(after.moderationAudit[0].actor,'netlify:owner-id');assert.equal(visible(after,b).moderationAudit,undefined);
 const social=createSocialHandler({store:()=>store});assert.equal((await social(req('/api/social?media='+pa,{uid:b}))).status,404);assert.equal((await handler(req('/api/moderation',{body:{...body,action:'restore'}}),context)).status,200);assert.equal((await social(req('/api/social?media='+pa,{uid:b,headers:{range:'bytes=0-1'}}))).status,206);
});
test('expired account records are cleaned without removing live sessions or unrelated data',async()=>{
 const s=memoryStore();await s.setJSON('sessions/old',{exp:1});await s.setJSON('sessions/live',{exp:Date.now()+100000});await s.setJSON('oauth/old',{exp:1});await s.setJSON('unrelated',{exp:1});assert.equal(await cleanAccounts(s),2);assert.ok(await s.get('sessions/live'));assert.ok(await s.get('unrelated'));
});
test('bounded account maintenance advances past live records rather than starving later expired sessions',async()=>{
 const s=memoryStore();for(const key of ['a','b','c'])await s.setJSON('sessions/'+key,{exp:Date.now()+100000});await s.setJSON('sessions/z',{exp:1});for(let i=0;i<4;i++)await cleanAccounts(s,{limit:1});assert.equal(await s.get('sessions/z'),null);assert.ok(await s.get('sessions/a'));
});
test('public-site moderation requires an explicitly listed, valid Kakao account session',async()=>{
 const {store,accounts,account,token}=await kakaoFixture(),handler=createModerationHandler({storeFactory:()=>store,accountsFactory:()=>accounts,read:k=>k==='VOICEGRAM_MODERATOR_KAKAO_UIDS'?account.uid:undefined});
 assert.equal((await handler(req('/api/moderation',{token}))).status,200);assert.equal((await handler(req('/api/moderation',{uid:account.uid}))).status,403);await accounts.setJSON('closed/'+account.uid,{at:Date.now()});assert.equal((await handler(req('/api/moderation',{token}))).status,403);
});
test('the existing project owner uses only verified site/user context; a remix, another member or an explicit empty override grants nothing',()=>{
 const good={site:{id:ownerPolicy.siteId},user:{id:ownerPolicy.ownerId}};assert.equal(moderatorIdentity(good,()=>undefined),'netlify:'+ownerPolicy.ownerId);assert.equal(moderatorIdentity({...good,site:{id:'another-site'}},()=>undefined),null);assert.equal(moderatorIdentity({...good,user:{id:'another-member'}},()=>undefined),null);assert.equal(moderatorIdentity(good,()=>''),null);assert.equal(moderatorIdentity({user:{id:ownerPolicy.ownerId}},()=>undefined),null);
});
test('expired upload cleanup removes abandoned complete media and preserves published media',async()=>{
 const store=memoryStore(),bytes=Buffer.alloc(30);bytes.write('ftyp',4);const digest=createHash('sha256').update(bytes).digest('hex'),ids=[randomUUID(),randomUUID()];for(const id of ids){await prepareUpload(store,'a',{id,size:bytes.length,type:'video/mp4',hash:digest});await uploadPart(store,'a',id,0,bytes);await finishUpload(store,'a',id);}const s=empty();mutate(s,'a',{action:'publish',id:ids[0],caption:'게시됨',media:{type:'video/mp4'}});await store.setJSON('community',s);await cleanUploads(store,Date.now()+3*3600000);assert.ok(await store.get('media/'+ids[0]));assert.equal(await store.get('media/'+ids[1]),null);
});
const activitySource=transformSync(readFileSync(new URL('../lib/story-activity.ts',import.meta.url),'utf8'),{loader:'ts',format:'esm'}).code;
const {storyActivity}=await import('data:text/javascript;base64,'+Buffer.from(activitySource).toString('base64'));
test('return-visit activity uses actual own posts and Korean calendar boundaries, excluding samples and future posts',()=>{
 const now=Date.parse('2026-11-15T01:00:00Z'),post=(created,extra={})=>({user:'a',created:Date.parse(created),...extra});
 const d=storyActivity([post('2026-11-14T16:00:00Z'),post('2026-11-14T12:00:00Z'),post('2026-11-13T12:00:00Z'),post('2026-11-16T12:00:00Z'),post('2026-11-15T00:00:00Z',{sample:true}),post('2026-11-15T00:00:00Z',{user:'b'})],'a',now);assert.deepEqual(d,{total:3,week:3,days:3,streak:3,today:true});assert.equal(storyActivity([],'a',now).streak,0);
});
