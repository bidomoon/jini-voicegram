/** Browser + actual function handlers. Only storage and external AI responses are test doubles. */
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {readFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {memoryStore} from './helpers/memory-store.mjs';
import {createStudioHandler} from '../netlify/functions/studio.mjs';
import {createSocialHandler} from '../netlify/functions/social.mjs';
import {createVideoPlanHandler} from '../netlify/functions/video-plan.mjs';
import chat from '../netlify/functions/chat.mjs';
import {sign} from '../netlify/functions/_shared/security.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:JSON.parse(process.env.CHROMIUM_ARGS||'[]'),headless:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--config','vite.netlify.config.ts','--host','127.0.0.1','--port','4173','--strictPort'],{cwd:root,stdio:['ignore','pipe','pipe']});
await new Promise((res,rej)=>{server.stdout.on('data',d=>{if(String(d).includes('Local:'))res();});server.on('exit',c=>rej(Error('Vite exited '+c)));});
const base='http://127.0.0.1:4173';
process.env.VOICEGRAM_ACCESS_CODE='browser-test-code-no-real-credentials';process.env.SOCIAL_SESSION_SECRET='browser-test-social-secret-no-real-credentials';process.env.OPENAI_API_KEY='test-only';process.env.MEDIA_ENABLED='true';process.env.CHAT_ENABLED='true';process.env.HF_API_KEY='test-id:test-secret';
const generation=memoryStore(),community=memoryStore(),studio=createStudioHandler({store:()=>generation}),social=createSocialHandler({store:()=>community});
const planner=createVideoPlanHandler({store:()=>generation});
let analyses=0,videos=0,dropPlan=true,dropVideo=true,dropPublish=true,videoKey=true;
const realFetch=globalThis.fetch;
const motionFixture={scene:'테스트 사진의 장면입니다.',summary:'카메라를 고정하고 사진 속 대상이 자연스럽게 움직이도록 설계해요.',prompt:'A steady continuous shot with natural independent subject motion, preserving the supplied image composition and style.',warnings:['이 화면 검증은 모의 응답을 사용합니다.']};
const fixtureDir=mkdtempSync(path.join(tmpdir(),'voicegram-video-'));
const fixturePath=process.env.QA_VIDEO_FIXTURE||path.join(fixtureDir,'fixture.mp4');
if(!process.env.QA_VIDEO_FIXTURE)execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=180x320:rate=15','-t','2','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart','-y',fixturePath]);
const clip=readFileSync(fixturePath);
globalThis.fetch=async(url,o)=>{
 if(String(url).endsWith('/responses')){analyses++;const b=JSON.parse(o.body);assert.match(b.input[0].content[1].image_url,/^data:image/);assert.equal(JSON.parse(b.input[0].content[0].text).caption,'가을 저녁의 음악');return Response.json({output:[{content:[{type:'output_text',text:JSON.stringify(motionFixture)}]}]});}
 if(String(url).endsWith('/files/generate-upload-url'))return Response.json({upload_url:'https://storage.example.test/reference',public_url:'https://cdn.example.test/reference.jpg',upload_headers:{'Content-Type':'image/jpeg'}});
 if(String(url)==='https://storage.example.test/reference')return new Response(null,{status:200});
 if(String(url).endsWith('/image-to-video')){videos++;const b=JSON.parse(o.body);assert.equal(b.duration,10);assert.equal(b.prompt,motionFixture.prompt);assert.equal(b.generate_audio,false);return Response.json({request_id:'11111111-2222-3333-4444-555555555555'});}
 if(String(url).endsWith('/status'))return Response.json({status:'completed',video:{url:'https://video.example.test/result.mp4'}});
 if(String(url)==='https://video.example.test/result.mp4')return new Response(clip,{headers:{'Content-Type':'video/mp4'}});
 throw Error('Unexpected external request: '+url);
};
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844}});
 if(process.env.QA_FONT_ROOT){let css='';for(const family of ['noto-sans-kr','noto-emoji']){const dir=path.join(process.env.QA_FONT_ROOT,family);css+=readFileSync(dir+'/400.css','utf8').replace(/url\(([^)]+)\)/g,(_,u)=>'url(data:font/woff2;base64,'+readFileSync(path.join(dir,u.replace(/["']/g,''))).toString('base64')+')');}css+=`.social-app,.social-dialog{font-family:'Noto Sans KR','Noto Emoji',sans-serif!important}`;await ctx.addInitScript(css=>{document.addEventListener('DOMContentLoaded',()=>{const s=document.createElement('style');s.textContent=css;document.head.appendChild(s);});},css);}

 const payload=Buffer.from(JSON.stringify({exp:Date.now()+3600000,nonce:randomUUID()})).toString('base64url');await ctx.addCookies([{name:'vg_session',value:payload+'.'+sign(payload),url:base,httpOnly:true,sameSite:'Strict'}]);
 await ctx.route('**/api/**',async route=>{
  const r=route.request(),url=new URL(r.url()),headers=await r.allHeaders(),req=new Request(r.url(),{method:r.method(),headers,body:r.method()==='GET'?undefined:r.postDataBuffer()});let response;
  if(url.pathname==='/api/video-plan'){response=await planner(req);if(r.method()==='POST'&&dropPlan){dropPlan=false;return route.abort('failed');}}
  else if(url.pathname==='/api/studio'){if(videoKey)process.env.HF_API_KEY='test-id:test-secret';else delete process.env.HF_API_KEY;response=await studio(req);if(r.method()==='POST'&&dropVideo){dropVideo=false;return route.abort('failed');}}
  else if(url.pathname==='/api/social'){response=await social(req);if(r.method()==='POST'&&headers['content-type']?.includes('multipart')&&dropPublish){dropPublish=false;return route.abort('failed');}}
  else if(url.pathname==='/api/chat')response=await chat(req);
  else response=Response.json(url.pathname==='/api/auth'?{kakaoReady:false,authenticated:false,provider:null}:{ready:false});
  await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
 });
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const nav=name=>page.locator('.bottom-nav').getByRole('button',{name,exact:true});
 await page.goto(base);await page.getByRole('button',{name:'글로 쓰기',exact:true}).first().click();await page.getByRole('button',{name:'영상',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'AI 동작 영상',exact:true}).getAttribute('aria-pressed'),'true');
 await page.locator('input[type=file]').setInputFiles(root+'/public/visuals/quiet-sea.webp');await page.getByRole('button',{name:'악기 연주',exact:false}).click();await page.locator('#brief').fill('사진 속 움직임을 자연스럽게 만들어줘');await page.locator('#video-caption').fill('가을 저녁의 음악');await page.getByRole('button',{name:'10초',exact:true}).click();
 await page.getByRole('button',{name:'사진·글로 영상 설계하기',exact:true}).click();assert.equal(analyses,0);assert.equal(videos,0);await page.getByRole('button',{name:'분석 비용을 확인하고 설계',exact:true}).click();await page.getByRole('button',{name:'기존 요청 결과 확인',exact:true}).waitFor();
 await page.getByRole('button',{name:'임시 저장',exact:true}).click();await page.getByText('이야기와 완성 파일을 이 기기에 임시 저장했어요.',{exact:true}).waitFor();await page.reload();await nav('만들기').click();await page.getByRole('button',{name:'기존 요청 결과 확인',exact:true}).click();await page.getByRole('heading',{name:'이렇게 움직일 거예요',exact:true}).waitFor();assert.equal(analyses,1);assert.equal(videos,0);
 assert.equal(await page.locator('.motion-plan-review').getByText('원본 사진 비율',{exact:true}).count(),1);assert.doesNotMatch(await page.locator('.motion-plan-review').innerText(),/\$|Runway/);
 for(const width of [360,390,430,768,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width);}
 await page.setViewportSize({width:390,height:844});await page.locator('.motion-plan-review').scrollIntoViewIfNeeded();mkdirSync('/tmp/voicegram-qa',{recursive:true});await page.screenshot({path:'/tmp/voicegram-qa/video-plan-mobile.png'});
 // The planner remains available without the paid-video key, but the generation button is disabled.
 videoKey=false;await page.getByRole('button',{name:'연결 상태 다시 확인',exact:true}).count().then(async n=>{if(!n){await page.evaluate(()=>window.dispatchEvent(new Event('voicegram-auth')));}});
 await page.getByRole('button',{name:'AI 동작 영상 연결 필요',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'AI 동작 영상 연결 필요',exact:true}).isDisabled(),true);
 videoKey=true;await page.getByRole('button',{name:'연결 상태 다시 확인',exact:true}).click();await page.getByRole('button',{name:'이 설계로 10초 영상 만들기',exact:true}).click();await page.getByText('힉스필드 앱 API 사용료가 별도로 발생합니다.',{exact:false}).waitFor();assert.equal(videos,0);await page.getByRole('button',{name:'비용 발생을 확인하고 생성',exact:true}).click();await page.getByRole('button',{name:'기존 요청 결과 확인',exact:true}).waitFor();
 await page.getByRole('button',{name:'임시 저장',exact:true}).click();await page.getByText('이야기와 완성 파일을 이 기기에 임시 저장했어요.',{exact:true}).waitFor();await page.reload();await nav('만들기').click();await page.getByRole('button',{name:'기존 요청 결과 확인',exact:true}).click();await page.getByRole('heading',{name:'게시 전 확인',exact:true}).waitFor();assert.equal(videos,1);assert.equal(analyses,1);assert.ok(await page.locator('.review-media video').isVisible());
 await page.locator('.review-media video').evaluate(v=>v.play());await page.waitForFunction(()=>document.querySelector('.review-media video').currentTime>0);
 await page.locator('#caption').fill('완성 영상을 나눕니다');await page.getByRole('button',{name:'피드에 게시하기',exact:true}).click();await page.getByRole('alert').last().waitFor();await page.getByRole('button',{name:'임시 저장',exact:true}).click();await page.getByText('이야기와 완성 파일을 이 기기에 임시 저장했어요.',{exact:true}).waitFor();await page.reload();await nav('만들기').click();await page.getByRole('heading',{name:'게시 전 확인',exact:true}).waitFor();await page.getByRole('button',{name:'피드에 게시하기',exact:true}).click();await page.locator('.feed-card').filter({hasText:'완성 영상을 나눕니다'}).waitFor();assert.equal((await community.get('community')).posts.length,1);assert.equal(videos,1);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({analyses,videos,paidCalls:0,posts:1,errors,flows:['photo + caption planning','lost analysis recovery','5/10 selection','missing key prevents video','cost confirmation','lost video response recovery','playback','publication retry','five viewport widths']}));
}finally{globalThis.fetch=realFetch;await browser.close();server.kill();rmSync(fixtureDir,{recursive:true,force:true});}
