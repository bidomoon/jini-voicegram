/** Browser + actual function handlers. Only storage and external AI responses are test doubles. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {memoryStore} from './helpers/memory-store.mjs';
import {createStudioHandler} from '../netlify/functions/studio.mjs';
import {createSocialHandler} from '../netlify/functions/social.mjs';
import chat from '../netlify/functions/chat.mjs';
import {sign} from '../netlify/functions/_shared/security.mjs';
const root=fileURLToPath(new URL('..',import.meta.url));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:JSON.parse(process.env.CHROMIUM_ARGS||'[]'),headless:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--config','vite.netlify.config.ts','--host','127.0.0.1','--port','4173','--strictPort'],{cwd:root,stdio:['ignore','pipe','pipe']});
await new Promise((res,rej)=>{server.stdout.on('data',d=>{if(String(d).includes('Local:'))res();});server.on('exit',c=>rej(Error('Vite exited '+c)));});
const base='http://127.0.0.1:4173';
process.env.VOICEGRAM_ACCESS_CODE='browser-test-code-no-real-credentials';process.env.SOCIAL_SESSION_SECRET='browser-test-social-secret-no-real-credentials';process.env.OPENAI_API_KEY='test-only';process.env.MEDIA_ENABLED='true';process.env.CHAT_ENABLED='true';
const generation=memoryStore(),community=memoryStore(),studio=createStudioHandler({store:()=>generation}),social=createSocialHandler({store:()=>community});
let providerCalls=0,edits=0,failNext=false,dropGeneration=false,dropPublication=false,generationReads=0,publicationWrites=0;
const realFetch=globalThis.fetch;
// Known local fixtures, never presented as real AI-created cats.
const fixtures=['quiet-sea.webp','voicegram-world.webp'].map(f=>readFileSync(root+'/public/visuals/'+f).toString('base64'));
globalThis.fetch=async(url,options)=>{if(!String(url).startsWith('https://api.openai.com/v1/images/'))throw Error('Unexpected external request: '+url);providerCalls++;if(failNext){failNext=false;return Response.json({error:{code:'rate_limit_exceeded'}},{status:429});}if(String(url).endsWith('/edits')){assert.ok(options.body.get('image') instanceof Blob);assert.ok(options.body.get('prompt').includes('수채화'));edits++;}return Response.json({data:[{b64_json:fixtures[edits%2]}]});};
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844}});
 const authPayload=Buffer.from(JSON.stringify({exp:Date.now()+3600000,nonce:randomUUID()})).toString('base64url');
 await ctx.addCookies([{name:'vg_session',value:authPayload+'.'+sign(authPayload),url:base,httpOnly:true,sameSite:'Strict'}]);
 await ctx.route('**/api/**',async route=>{const r=route.request(),url=new URL(r.url());const headers=await r.allHeaders();const req=new Request(r.url(),{method:r.method(),headers,body:r.method()==='GET'?undefined:r.postDataBuffer()});let response;
  if(url.pathname==='/api/studio'){if(url.searchParams.has('requestId'))generationReads++;response=await studio(req);if(r.method()==='POST'&&dropGeneration){dropGeneration=false;return route.abort('failed');}}
  else if(url.pathname==='/api/social'){response=await social(req);if(r.method()==='POST'&&headers['content-type']?.includes('multipart')){publicationWrites++;if(dropPublication){dropPublication=false;return route.abort('failed');}}}
  else if(url.pathname==='/api/chat')response=await chat(req);
  else response=Response.json(url.pathname==='/api/auth'?{kakaoReady:false,authenticated:false,provider:null}:{ready:false});
  await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
 });
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const nav=name=>page.locator('.bottom-nav').getByRole('button',{name,exact:true});
 await page.goto(base);await page.getByRole('button',{name:'글로 쓰기',exact:true}).first().click();await page.locator('#story-caption').fill('예쁜 고양이 그려줘');await page.getByRole('button',{name:'AI로 그림 만들기',exact:true}).click();assert.equal(providerCalls,0);await page.getByRole('button',{name:'비용 발생을 확인하고 생성'}).click();await page.getByRole('heading',{name:'게시 전 확인',exact:true}).waitFor();assert.equal(providerCalls,1);assert.equal(await page.locator('#caption').inputValue(),'');
 const original=await page.locator('.review-media canvas').evaluate(c=>c.toDataURL());
 await page.getByRole('button',{name:'이 그림 수정하기',exact:true}).click();await page.locator('#brief').fill('고양이 주변을 따뜻한 수채화 느낌으로 바꿔줘');await page.getByRole('button',{name:'수채화',exact:true}).click();assert.equal(await page.getByRole('checkbox',{name:'이 그림을 참고해서 만들기'}).isChecked(),true);await page.getByRole('button',{name:'확인하고 그림 만들기'}).click();await page.getByRole('button',{name:'비용 발생을 확인하고 생성'}).click();await page.getByRole('heading',{name:'게시 전 확인',exact:true}).waitFor();assert.equal(edits,1);await page.getByRole('button',{name:'이전 그림으로',exact:true}).click();await page.waitForFunction(before=>document.querySelector('.review-media canvas').toDataURL()===before,original);
 await page.locator('#caption').fill('완성된 그림과 함께 나누는 이야기');await page.getByRole('button',{name:'임시 저장',exact:true}).click();await page.getByText('이야기와 완성 파일을 이 기기에 임시 저장했어요.',{exact:true}).waitFor();
 await page.reload();await nav('만들기').click();await page.getByRole('heading',{name:'게시 전 확인',exact:true}).waitFor();assert.equal(await page.locator('#caption').inputValue(),'완성된 그림과 함께 나누는 이야기');await page.waitForFunction(before=>document.querySelector('.review-media canvas').toDataURL()===before,original);assert.equal(providerCalls,2);
 // Server accepts publication, but the browser loses its response. Reload and retry remain one post.
 dropPublication=true;await page.getByRole('button',{name:'피드에 게시하기'}).click();await page.getByRole('alert').last().waitFor();await page.getByRole('button',{name:'임시 저장',exact:true}).click();await page.reload();await nav('만들기').click();await page.getByRole('heading',{name:'게시 전 확인',exact:true}).waitFor();await page.getByRole('button',{name:'피드에 게시하기'}).click();await page.locator('.feed-card').filter({hasText:'완성된 그림과 함께 나누는 이야기'}).waitFor();const state=await community.get('community');assert.equal(state.posts.length,1);assert.equal(publicationWrites,2);assert.ok(state.posts[0].media);assert.equal(state.posts[0].ai,true);
 await nav('만들기').click();await page.getByRole('button',{name:'글로 쓰기',exact:true}).click();assert.equal(await page.locator('#story-caption').inputValue(),'');
 // Generation succeeds on the server, response is lost, and reload restores its request ID.
 await page.locator('#story-caption').fill('예쁜 고양이 그려줘');await page.getByRole('button',{name:'AI로 그림 만들기',exact:true}).click();dropGeneration=true;await page.getByRole('button',{name:'비용 발생을 확인하고 생성'}).click();await page.getByRole('button',{name:'기존 요청 결과 확인'}).waitFor();await page.getByRole('button',{name:'임시 저장',exact:true}).click();await page.reload();await nav('만들기').click();await page.getByRole('button',{name:'기존 요청 결과 확인'}).click();await page.getByRole('heading',{name:'게시 전 확인',exact:true}).waitFor();assert.equal(providerCalls,3);assert.equal(generationReads,1);
 // Known provider failure keeps the previous image and allows an explicit new confirmation.
 await page.getByRole('button',{name:'이 그림 수정하기'}).click();await page.locator('#brief').fill('수채화 느낌으로 바꿔줘');failNext=true;await page.getByRole('button',{name:'확인하고 그림 만들기'}).click();await page.getByRole('button',{name:'비용 발생을 확인하고 생성'}).click();await page.getByText('생성을 완료하지 못했어요',{exact:true}).waitFor();assert.ok(await page.locator('.reference-choice img').isVisible());await page.getByRole('button',{name:'비용 확인 후 다시 만들기'}).click();assert.equal(providerCalls,4);await page.getByRole('button',{name:'취소',exact:true}).click();
 // Local photo video finishes into review; its Blob survives reload.
 await page.getByRole('button',{name:'내 사진으로 만들기',exact:true}).click();await page.getByRole('button',{name:'영상',exact:true}).click();await page.getByRole('button',{name:'사진 확대 효과',exact:true}).click();await page.getByRole('button',{name:'6초 확대 효과 만들기',exact:true}).click();await page.getByRole('heading',{name:'게시 전 확인',exact:true}).waitFor();assert.ok(await page.locator('.review-media video').isVisible());await page.getByRole('button',{name:'임시 저장',exact:true}).click();await page.getByText('이야기와 완성 파일을 이 기기에 임시 저장했어요.',{exact:true}).waitFor();await page.reload();await nav('만들기').click();await page.getByRole('heading',{name:'게시 전 확인',exact:true}).waitFor();assert.ok(await page.locator('.review-media video').isVisible());assert.equal(providerCalls,4);
 for(const width of [360,390,430,768,1440]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width);}
 assert.deepEqual(errors,[]);console.log(JSON.stringify({provider:'local fixtures only, no paid calls',actualHandlers:['studio','social','chat'],providerCalls,edits,posts:state.posts.length,publicationWrites,generationReads,flows:['generation confirmation','reference-image edit','previous image','draft and image after reload','lost publish response deduplicated after reload','lost generation response recovered without another call','provider failure preserves image','six-second local video and Blob recovery'],widths:[360,390,430,768,1440],errors}));
}finally{globalThis.fetch=realFetch;await browser.close();server.kill();}
