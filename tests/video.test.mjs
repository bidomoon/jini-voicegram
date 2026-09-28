import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {memoryStore} from './helpers/memory-store.mjs';
import {createVideoPlanHandler,validateVideoPlan} from '../netlify/functions/video-plan.mjs';
import {createStudioHandler} from '../netlify/functions/studio.mjs';
import {createSocialHandler} from '../netlify/functions/social.mjs';
import {sign} from '../netlify/functions/_shared/security.mjs';
import {completedVideo,VIDEO_MAX_BYTES,videoTicket,taskStatus} from '../netlify/functions/_shared/video.mjs';
const base='https://voicegram.test';
const planData={scene:'활을 든 연주자가 있는 그림입니다.',summary:'카메라는 고정하고 활과 손가락을 움직이며 연주해요.',prompt:'The illustrated musician plays the visible bowed instrument, bow arm moving back and forth with coordinated fingering. Gentle body movement. A steady continuous shot preserving the original illustration and setting.',warnings:['포스터 글씨와 손가락은 달라질 수 있어요.']};
function cookie(){const p=Buffer.from(JSON.stringify({exp:Date.now()+3600000,nonce:randomUUID()})).toString('base64url');return 'vg_session='+p+'.'+sign(p);}
const photo=new Blob([Buffer.from([255,216,255,224,1,2,3])],{type:'image/jpeg'});
function form(patch={}){const f=new FormData();for(const [k,v] of Object.entries({confirmed:'true',requestId:randomUUID(),prompt:'비올라를 연주해줘',caption:'가을 음악회',duration:'5',motion:'perform',ratio:'9:16',photo,...patch}))if(v!==null)f.set(k,v);return f;}
function request(path,body,auth){return new Request(base+path,{method:body?'POST':'GET',headers:{cookie:auth,origin:base},body});}
function setup(){process.env.VOICEGRAM_ACCESS_CODE='test-video-only-no-real-credentials';process.env.SOCIAL_SESSION_SECRET='test-video-social-secret-no-real-credentials';process.env.OPENAI_API_KEY='test';process.env.HF_API_KEY='test-id:test-secret';delete process.env.HF_API_KEY_ID;delete process.env.HF_API_KEY_SECRET;process.env.RUNWAYML_API_SECRET='legacy-test';process.env.MEDIA_ENABLED='true';const store=memoryStore();return {plan:createVideoPlanHandler({store:()=>store}),studio:createStudioHandler({store:()=>store}),auth:cookie()};}
function uploadFixture(url,o){
 if(String(url).endsWith('/files/generate-upload-url')){assert.equal(o.headers.Authorization,'Key test-id:test-secret');assert.deepEqual(JSON.parse(o.body),{content_type:'image/jpeg'});return Response.json({upload_url:'https://storage.example.test/upload',public_url:'https://cdn.example.test/reference.jpg',upload_headers:{'Content-Type':'image/jpeg','x-amz-tagging':'retention=temporary'}});}
 if(String(url)==='https://storage.example.test/upload'){assert.equal(o.method,'PUT');assert.equal(o.credentials,'omit');assert.equal(o.headers.get('authorization'),null);assert.equal(o.headers.get('x-amz-tagging'),'retention=temporary');assert.equal(o.body.size,photo.size);return new Response(null,{status:200});}
}

test('vision planning includes the actual image and caption; approval binds one paid video request to its source and duration',async()=>{
 const {plan,studio,auth}=setup();let analyses=0,videos=0;const real=globalThis.fetch;
 globalThis.fetch=async(url,o)=>{const upload=uploadFixture(url,o);if(upload)return upload;const b=JSON.parse(o.body);if(String(url).endsWith('/responses')){analyses++;assert.equal(b.store,false);assert.equal(b.input[0].content[1].type,'input_image');assert.match(b.input[0].content[1].image_url,/^data:image\/jpeg;base64,/);assert.equal(JSON.parse(b.input[0].content[0].text).caption,'가을 음악회');return Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(planData)}]}]});}assert.equal(String(url),'https://api.higgsfield.ai/bytedance/seedance-2.0/image-to-video');assert.equal(o.headers.Authorization,'Key test-id:test-secret');videos++;assert.equal(b.prompt,planData.prompt);assert.ok([5,10].includes(b.duration));assert.equal(b.image_url,'https://cdn.example.test/reference.jpg');assert.equal(b.resolution,'720p');assert.equal(b.generate_audio,false);assert.equal(b.aspect_ratio,undefined);return Response.json({request_id:randomUUID()});};
 try{
  for(const duration of ['5','10']){
   const planId=randomUUID();const first=await plan(request('/api/video-plan',form({requestId:planId,duration}),auth));assert.equal(first.status,200);const d=(await first.json()).plan;assert.equal(videos,Number(duration=== '10'));
   const again=await plan(request('/api/video-plan',form({requestId:planId,duration}),auth));assert.equal((await again.json()).plan.id,d.id);
   const params={kind:'video',planId,requestId:d.videoRequestId,duration};
   for(const patch of [{duration:duration==='5'?'10':'5'},{caption:'바꾼 게시글'},{photo:new Blob(['changed'],{type:'image/jpeg'})},{requestId:randomUUID()},{planId:randomUUID()}])assert.equal((await studio(request('/api/studio',form({...params,...patch}),auth))).status,400);
   assert.equal((await studio(request('/api/studio',form(params),cookie()))).status,400);
   const start=await studio(request('/api/studio',form(params),auth));assert.equal(start.status,200);const job=await start.json();assert.equal(job.duration,Number(duration));
   const retry=await studio(request('/api/studio',form(params),auth));assert.equal((await retry.json()).id,job.id);
   const recovered=await studio(request('/api/studio?requestId='+d.videoRequestId,null,auth));assert.equal((await recovered.json()).id,job.id);
  }
  assert.equal(analyses,2);assert.equal(videos,2);
 }finally{globalThis.fetch=real;}
});

test('invalid or uncertain analysis never starts video or retries automatically; unavailable video never substitutes a zoom clip',async()=>{
 const {plan,studio,auth}=setup();const real=globalThis.fetch;let calls=0;
 try{
  for(const failure of ['invalid','timeout']){
   globalThis.fetch=async()=>{calls++;if(failure==='timeout')throw Error('lost response');return Response.json({output:[{content:[{type:'output_text',text:JSON.stringify({...planData,prompt:'x'.repeat(1001)})}]}]});};
   const id=randomUUID();await plan(request('/api/video-plan',form({requestId:id}),auth));await plan(request('/api/video-plan',form({requestId:id}),auth));await plan(request('/api/video-plan?requestId='+id,null,auth));
  }assert.equal(calls,2);
  delete process.env.HF_API_KEY;
  const caps=await(await studio(request('/api/studio',null,auth))).json();assert.equal(caps.video,false);assert.equal(caps.videoPlan,true);assert.equal(caps.videoProvider,'higgsfield');assert.equal(caps.videoCreditsPerSecond,undefined);
  assert.equal((await studio(request('/api/studio',form({kind:'video'}),auth))).status,503);assert.equal(calls,2);
  assert.throws(()=>validateVideoPlan({...planData,prompt:'x'.repeat(1001)}));
 }finally{globalThis.fetch=real;}
});

test('completed video import is owner-bound, supports files over multipart limit, and deduplicates publication without another download',async()=>{
 const {plan,studio,auth}=setup();const socialStore=memoryStore(),social=createSocialHandler({store:()=>socialStore});let downloads=0;const real=globalThis.fetch;
 const mp4=Buffer.alloc(5_000_000);mp4.write('ftyp',4);
 globalThis.fetch=async(url,o)=>{const upload=uploadFixture(url,o);if(upload)return upload;if(String(url).endsWith('/responses'))return Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(planData)}]}]});if(String(url).endsWith('/image-to-video'))return Response.json({request_id:randomUUID()});if(String(url).endsWith('/status'))return Response.json({status:'completed',video:{url:'https://video.example.test/result.mp4'}});downloads++;return new Response(mp4,{headers:{'Content-Type':'video/mp4'}});};
 try{
  const d=(await(await plan(request('/api/video-plan',form(),auth))).json()).plan;
  const job=await(await studio(request('/api/studio',form({kind:'video',planId:d.id,requestId:d.videoRequestId}),auth))).json();
  await assert.rejects(()=>completedVideo(request('/api/studio',null,cookie()),job.id,job.token),e=>e.status===403);assert.equal(downloads,0);
  const who=await social(request('/api/social',null,auth));const owner=auth+'; '+who.headers.get('set-cookie').split(';')[0];
  const id=randomUUID(),publish=()=>{const f=new FormData();f.set('id',id);f.set('caption','완성 영상');f.set('videoJob',job.id);f.set('videoToken',job.token);return request('/api/social',f,owner);};
  assert.equal((await social(publish())).status,200);assert.equal((await social(publish())).status,200);assert.equal(downloads,1);assert.equal((await socialStore.get('community')).posts.length,1);assert.equal((await socialStore.getMetadata('media/'+id)).metadata.type,'video/mp4');
  globalThis.fetch=async url=>String(url).endsWith('/status')?Response.json({status:'completed',video:{url:'https://video.example.test/result.mp4'}}):new Response(mp4,{headers:{'Content-Length':String(VIDEO_MAX_BYTES+1)}});
  await assert.rejects(()=>completedVideo(request('/api/studio',null,auth),job.id,job.token),e=>e.status===413);
 }finally{globalThis.fetch=real;}
});

test('Higgsfield upload failure, billing refusal and uncertain submission never retry the paid request',async()=>{
 const real=globalThis.fetch;
 try{for(const failure of ['upload','billing','server','lost']){
  const {plan,studio,auth}=setup();let posts=0;
  globalThis.fetch=async(url,o)=>{
   if(String(url).endsWith('/responses'))return Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(planData)}]}]});
   if(failure==='upload'&&String(url)==='https://storage.example.test/upload')return new Response(null,{status:503});
   const upload=uploadFixture(url,o);if(upload)return upload;
   assert.match(String(url),/image-to-video$/);posts++;
   if(failure==='lost')throw Error('response lost');
   return Response.json({error:'provider message must not leak'}, {status:failure==='billing'?402:500});
  };
  const p=(await(await plan(request('/api/video-plan',form({ratio:'original'}),auth))).json()).plan;
  const params={kind:'video',planId:p.id,requestId:p.videoRequestId,ratio:'original'};
  const first=await(await studio(request('/api/studio',form(params),auth))).json();
  assert.equal(first.state,['server','lost'].includes(failure)?'unknown':'failed');
  if(failure==='billing')assert.match(first.error,/잔액/);
  await studio(request('/api/studio',form(params),auth));await studio(request('/api/studio?requestId='+p.videoRequestId,null,auth));
  assert.equal(posts,failure==='upload'?0:1);
 }}finally{globalThis.fetch=real;}
});

test('Higgsfield terminal states stop polling, ownership protects downloads and old Runway jobs remain readable',async()=>{
 const {studio,auth}=setup();const real=globalThis.fetch;
 const payload=JSON.parse(Buffer.from(auth.split('=')[1].split('.')[0],'base64url'));
 const id='hf-'+randomUUID(),token=videoTicket(id,payload);
 try{
  for(const status of ['queued','in_progress','completed','failed','nsfw','canceled']){
   globalThis.fetch=async(url,o)=>{assert.equal(String(url),'https://api.higgsfield.ai/requests/'+id.slice(3)+'/status');assert.equal(o.headers.Authorization,'Key test-id:test-secret');return Response.json({status,video:status==='completed'?{url:'https://video.example.test/clip.mp4'}:undefined});};
   assert.equal((await studio(request('/api/studio?id='+id+'&token='+token,null,cookie()))).status,403);
   const d=await(await studio(request('/api/studio?id='+id+'&token='+token,null,auth))).json();
   assert.equal(d.status,status==='completed'?'completed':['failed','nsfw','canceled'].includes(status)?'failed':'queued');
  }
  delete process.env.HF_API_KEY;
  globalThis.fetch=async(url,o)=>{assert.equal(String(url),'https://api.dev.runwayml.com/v1/tasks/legacy-fixture');assert.equal(o.headers.Authorization,'Bearer legacy-test');return Response.json({status:'SUCCEEDED',output:['https://video.example.test/old.mp4']});};
  assert.equal((await taskStatus('legacy-fixture')).status,'SUCCEEDED');
 }finally{globalThis.fetch=real;}
});
