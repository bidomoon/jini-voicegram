/** Actual social handler with isolated in-memory data; no live writes or paid APIs. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHmac,randomUUID} from 'node:crypto';
import {memoryStore} from './helpers/memory-store.mjs';
import {empty} from '../netlify/functions/_shared/social-core.mjs';
import {createSocialHandler} from '../netlify/functions/social.mjs';
import {sign} from '../netlify/functions/_shared/security.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:JSON.parse(process.env.CHROMIUM_ARGS||'[]'),headless:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--config','vite.netlify.config.ts','--host','127.0.0.1','--port','4173','--strictPort'],{cwd:root,stdio:['ignore','pipe','pipe']});
await new Promise((res,rej)=>{server.stdout.on('data',d=>{if(String(d).includes('Local:'))res();});server.on('exit',c=>rej(Error('Vite exited '+c)));});
const base='http://127.0.0.1:4173',uid=randomUUID(),alice=randomUUID(),bob=randomUUID();
process.env.VOICEGRAM_ACCESS_CODE='feed-test-code-no-real-credentials';process.env.SOCIAL_SESSION_SECRET='feed-test-social-secret-no-real-credentials';
const store=memoryStore(),handler=createSocialHandler({store:()=>store}),state=empty(),ids=Array.from({length:28},()=>randomUUID());
state.profiles={[uid]:{id:uid,name:'나의 하루',emoji:'🌷',bio:''},[alice]:{id:alice,name:'산책하는 하루',emoji:'🌊',bio:'함께 걷는 일상'},[bob]:{id:bob,name:'다정한 이웃',emoji:'☕',bio:'오늘의 작은 행복'}};
state.follows=[{user:alice,target:uid,created:Date.now()},{user:uid,target:alice,created:Date.now()}];
state.posts=ids.map((id,i)=>({id,user:i%2?bob:alice,caption:i===0?'산책에서 만난 작은 행복. 🌊\n'+('천천히 걸으면 새로운 장면이 보여요. '.repeat(15)):i===1?'말 한마디로 나누는 오늘의 이야기 💜':'우리의 일상 '+i,created:Date.now()-i*60000,media:i===11?{type:'video/webm'}:i%3===0?{type:'image/webp'}:null}));
state.comments=[{id:randomUUID(),user:bob,post:ids[0],body:'함께 걷고 싶어요 💜',created:Date.now()}];
await store.setJSON('community',state);
const picture=readFileSync(root+'/public/visuals/quiet-sea.webp');
for(const p of state.posts.filter(p=>p.media?.type.startsWith('image')))await store.set('media/'+p.id,new Uint8Array(picture).buffer,{metadata:{type:'image/webp',user:p.user}});
let likeWrites=0,failLike=false,holdLike=false,releaseLike,holdRead=false,releaseRead,likeStarted,readStarted;
let likeStart=()=>{},readStart=()=>{};
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844}});
 if(process.env.QA_FONT_ROOT){let css='';for(const family of ['noto-sans-kr','noto-emoji']){const dir=path.join(process.env.QA_FONT_ROOT,family);css+=readFileSync(dir+'/400.css','utf8').replace(/url\(([^)]+)\)/g,(_,u)=>'url(data:font/woff2;base64,'+readFileSync(path.join(dir,u.replace(/["']/g,''))).toString('base64')+')');}css+=`.social-app,.social-dialog{font-family:'Noto Sans KR','Noto Emoji',sans-serif!important}`;await ctx.addInitScript(css=>{document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent=css;document.head.appendChild(s);});},css);}

 const token=Buffer.from(JSON.stringify({exp:Date.now()+3600000,nonce:randomUUID()})).toString('base64url'),exp=Date.now()+3600000;
 const person=uid+'.'+exp+'.'+createHmac('sha256',process.env.SOCIAL_SESSION_SECRET).update('person:'+uid+'.'+exp).digest('hex');
 await ctx.addCookies([{name:'vg_session',value:token+'.'+sign(token),url:base,httpOnly:true,sameSite:'Strict'},{name:'vg_person',value:person,url:base,httpOnly:true,sameSite:'Lax'}]);
 await ctx.route('**/api/**',async route=>{
  const r=route.request(),url=new URL(r.url()),headers=await r.allHeaders();let response;
  if(url.pathname==='/api/social'){
   const a=r.method()==='POST'&&headers['content-type']?.includes('json')?r.postDataJSON():null;
   if(a?.action==='like'){likeWrites++;likeStart();if(holdLike)await new Promise(res=>{releaseLike=res;});}
   if(a?.action==='like'&&failLike){failLike=false;response=Response.json({error:'테스트 연결 실패'},{status:503});}
   else response=await handler(new Request(r.url(),{method:r.method(),headers,body:r.method()==='GET'?undefined:r.postDataBuffer()}));
   if(r.method()==='GET'&&!url.search&&holdRead){readStart();await new Promise(res=>{releaseRead=res;});}
  }else if(url.pathname==='/api/auth')response=Response.json({kakaoReady:false,authenticated:false,provider:null});
  else if(url.pathname==='/api/studio')response=Response.json({authenticated:true,imageReady:false,videoReady:false});
  else response=Response.json({ready:false});
  await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
 });
 const page=await ctx.newPage(),errors=[],scripts=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.resourceType()==='script')scripts.push(r.url());});
 await page.goto(base);await page.locator('.feed-card').first().waitFor();
 // Generate a local browser video fixture; no external generation service.
 const videoBytes=await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=80;c.height=100;const stream=c.captureStream(8),recorder=new MediaRecorder(stream,{mimeType:'video/webm'}),parts=[];recorder.ondataavailable=e=>parts.push(e.data);const result=new Promise(resolve=>{recorder.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());resolve([...new Uint8Array(await new Blob(parts).arrayBuffer())]);};});recorder.start();let frame=0;const tick=setInterval(()=>{const g=c.getContext('2d');g.fillStyle=frame++%2?'#8171af':'#dcc4ef';g.fillRect(0,0,80,100);},100);setTimeout(()=>{clearInterval(tick);recorder.stop();},1100);return result;});
 await store.set('media/'+ids[11],new Uint8Array(videoBytes).buffer,{metadata:{type:'video/webm',user:state.posts[11].user}});

 assert.equal(await page.locator('.social-center>.feed-card').count(),12);
 assert.ok(!scripts.some(s=>s.includes('story-composer')||s.includes('billing-panel')),'creation and billing must not load on the feed');
 const first=page.locator('.social-center>.feed-card').first();
 assert.equal(await first.locator('img').getAttribute('loading'),'eager');
 assert.equal(await page.locator('.social-center>.feed-card video').getAttribute('src'),null,'offscreen video must not download metadata');
 await first.getByRole('button',{name:'더 보기',exact:true}).click();assert.equal(await first.locator('.caption-collapsed').count(),0);await first.getByRole('button',{name:'접기',exact:true}).click();
 // The heart changes before the server responds and one double-click sends one request.
 holdLike=true;likeStarted=new Promise(res=>{likeStart=res;});await first.locator('.post-media img').dblclick();await likeStarted;
 assert.equal(await first.getByRole('button',{name:'좋아요 취소',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(likeWrites,1);
 releaseLike();holdLike=false;await first.getByRole('button',{name:'좋아요 취소',exact:true}).isEnabled();await page.waitForFunction(()=>!document.querySelector('.post-actions button').disabled);
 assert.equal((await store.get('community')).likes.length,1);
 // Failed unlike rolls back the optimistic state.
 failLike=true;await first.getByRole('button',{name:'좋아요 취소',exact:true}).click();await page.getByText('테스트 연결 실패',{exact:true}).waitFor();assert.equal(await first.getByRole('button',{name:'좋아요 취소',exact:true}).getAttribute('aria-pressed'),'true');
 // A refresh response captured before a write cannot replace the newer state.
 holdRead=true;readStarted=new Promise(res=>{readStart=res;});await page.getByRole('button',{name:'피드 새로고침'}).click();await readStarted;
 await first.getByRole('button',{name:'좋아요 취소',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.post-actions button').getAttribute('aria-pressed')==='false'&&!document.querySelector('.post-actions button').disabled);
 releaseRead();holdRead=false;await page.waitForFunction(()=>!document.querySelector('[aria-label="피드 새로고침"]').disabled);assert.equal(await first.getByRole('button',{name:'좋아요',exact:true}).getAttribute('aria-pressed'),'false');
 // Persistent comments through the actual handler, bottom sheet and keyboard focus.
 await first.getByRole('button',{name:'댓글 열기'}).click();await page.getByRole('button',{name:'💜 댓글에 넣기'}).click();await page.getByRole('textbox',{name:'댓글',exact:true}).fill('오늘도 즐거운 하루예요 💜');await page.getByRole('button',{name:'댓글 보내기'}).click();await page.locator('.comment-list').getByText('오늘도 즐거운 하루예요 💜').waitFor();
 assert.equal((await store.get('community')).comments.length,2);
 const sheet=await page.locator('.comments-sheet').boundingBox();assert.ok(Math.abs(sheet.y+sheet.height-844)<3,'comment sheet anchors to the bottom');
 mkdirSync('/tmp/voicegram-feed-qa',{recursive:true});await page.screenshot({path:'/tmp/voicegram-feed-qa/comments.png'});await page.getByRole('button',{name:'Close',exact:true}).click();
 // Share fallback keeps the exact post ID; opening its URL restores the correct post.
 await page.evaluate(()=>Object.defineProperty(navigator,'share',{value:undefined,configurable:true}));await first.getByRole('button',{name:'게시물 공유'}).click();const link=await page.locator('#post-link').inputValue();assert.equal(new URL(link).searchParams.get('post'),ids[0]);await page.getByRole('button',{name:'Close',exact:true}).click();
 const shared=await ctx.newPage();await shared.goto(link);await shared.locator('.post-detail').waitFor();assert.equal(await shared.locator('.post-detail .feed-card').getAttribute('data-post-id'),ids[0]);await shared.close();
 // More posts are opt-in, and tab navigation returns to the last feed position.
 await page.getByRole('button',{name:/이야기 더 보기/}).click();assert.equal(await page.locator('.social-center>.feed-card').count(),24);
 const video=page.locator('.social-center>.feed-card video').first();await video.scrollIntoViewIfNeeded();await video.evaluate(async v=>{v.muted=true;v.loop=true;if(v.readyState<2)await new Promise((res,rej)=>{v.addEventListener('loadeddata',res,{once:true});v.addEventListener('error',rej,{once:true});});return v.play();});await page.evaluate(()=>scrollTo(0,0));await page.waitForFunction(()=>document.querySelector('.social-center>.feed-card video').paused);

 await page.evaluate(()=>scrollTo(0,600));const scroll=await page.evaluate(()=>scrollY);await page.locator('.bottom-nav').getByRole('button',{name:'둘러보기',exact:true}).click();await page.locator('.bottom-nav').getByRole('button',{name:'홈',exact:true}).click();assert.equal(await page.evaluate(()=>scrollY),scroll);
 await page.locator('.bottom-nav').getByRole('button',{name:'내 프로필',exact:true}).click();await page.getByRole('button',{name:'1 팔로워',exact:true}).click();await page.locator('.connections-list').getByText('산책하는 하루',{exact:true}).waitFor();await page.getByRole('button',{name:'Close',exact:true}).click();
 for(const width of [360,390,430,768,1440]){
  await page.setViewportSize({width,height:900});
  for(const view of ['홈','둘러보기','내 프로필']){
   const nav=page.locator(width<768?'.bottom-nav':'.social-sidebar nav');await nav.getByRole('button',{name:view,exact:true}).click();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width+' '+view);
   if(view==='홈')await page.evaluate(()=>scrollTo(0,0));if((width===390||width===1440)&&view!=='내 프로필')await page.screenshot({path:`/tmp/voicegram-feed-qa/${width}-${view==='홈'?'home':'explore'}.png`});
  }
 }
 await page.setViewportSize({width:390,height:844});await page.locator('.bottom-nav').getByRole('button',{name:'만들기',exact:true}).click();await page.locator('.compose-page').waitFor();assert.ok(scripts.some(s=>s.includes('story-composer')));
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({actualHandler:'social',liveWrites:0,paidCalls:0,likeWrites,initialCards:12,afterMore:24,flows:['lazy creation chunks','eager first image','offscreen video deferred','caption expand','double tap optimistic like','failed like rollback','stale refresh ignored','persisted comment','mobile comment sheet','share deep link','scroll restore','video pauses offscreen','follower list'],widths:[360,390,430,768,1440],errors}));
}finally{await browser.close();server.kill();}
