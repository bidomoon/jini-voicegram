import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {empty,mutate,visible,update} from '../netlify/functions/_shared/social-core.mjs';
import handler from '../netlify/functions/social.mjs';
test('different users can publish, react and comment; retries do not duplicate',()=>{const s=empty();const id=randomUUID(),cid=randomUUID();mutate(s,'a',{action:'profile',name:'A'});mutate(s,'b',{action:'profile',name:'B'});mutate(s,'a',{action:'publish',id,caption:'첫 이야기'});mutate(s,'a',{action:'publish',id,caption:'retry'});mutate(s,'b',{action:'like',id,value:true});mutate(s,'b',{action:'like',id,value:true});mutate(s,'b',{action:'comment',id,body:'반가워요',requestId:cid});mutate(s,'b',{action:'comment',id,body:'반가워요',requestId:cid});assert.equal(s.posts.length,1);assert.equal(visible(s,'a').posts[0].likes,1);assert.equal(visible(s,'a').posts[0].comments.length,1);assert.equal(visible(s,'a').notifications.length,2);assert.throws(()=>mutate(s,'b',{action:'delete',id}),e=>e.status===403);assert.throws(()=>mutate(s,'a',{action:'deleteComment',id:cid}),e=>e.status===403);});
test('blocking filters both directions and report data is private',()=>{const s=empty(),id=randomUUID();mutate(s,'a',{action:'publish',id,caption:'one'});mutate(s,'b',{action:'profile',name:'B'});mutate(s,'b',{action:'follow',id:'a',value:true});mutate(s,'b',{action:'report',id,reason:'test'});assert.equal(visible(s,'a').reports,undefined);mutate(s,'b',{action:'block',id:'a',value:true});assert.equal(visible(s,'b').posts.length,0);assert.equal(visible(s,'a').profiles.length,1);assert.equal(visible(s,'a').followers.length,0);assert.throws(()=>mutate(s,'b',{action:'comment',id,body:'blocked',requestId:randomUUID()}),e=>e.status===404);});
test('deletion hides media and notifications, no impersonation',()=>{const s=empty(),id=randomUUID();mutate(s,'a',{action:'publish',id,caption:'one',user:'b',media:{type:'image/jpeg'}});assert.equal(s.posts[0].user,'a');mutate(s,'a',{action:'delete',id});assert.equal(visible(s,'a').posts.length,0);});
test('concurrent updates retry using etag instead of overwriting',async()=>{let value=null,etag=0;const store={async getWithMetadata(){return value?{data:structuredClone(value),etag:String(etag)}:null;},async setJSON(k,v,opt){if(opt.onlyIfNew&&value||opt.onlyIfMatch&&opt.onlyIfMatch!==String(etag))return {modified:false};value=structuredClone(v);etag++;return {modified:true};}};await Promise.all([update(store,'a',{action:'profile',name:'A'}),update(store,'b',{action:'profile',name:'B'})]);assert.equal(Object.keys(value.profiles).length,2);});
test('unauthenticated social requests are denied',async()=>{const res=await handler(new Request('https://example.test/api/social'));assert.equal(res.status,401);});
test('caption editing belongs to the author, preserves media and reactions, and retries without changing edit time',()=>{
 const s=empty(),id=randomUUID(),cid=randomUUID(),created=100000;
 mutate(s,'a',{action:'publish',id,caption:'처음',media:{type:'video/webm'},ai:true},created);
 mutate(s,'b',{action:'like',id,value:true},created+1);
 mutate(s,'b',{action:'comment',id,body:'반가워요',requestId:cid},created+2);
 assert.throws(()=>mutate(s,'b',{action:'editPost',id,caption:'도용',expectedCaption:'처음',user:'a'},created+3),e=>e.status===403);
 mutate(s,'a',{action:'editPost',id,caption:'  바뀐 이야기  ',expectedCaption:'처음',media:null,created:0,ai:false},created+4);
 const p=visible(s,'a').posts[0];assert.equal(p.caption,'바뀐 이야기');assert.equal(p.created,created);assert.equal(p.edited,created+4);assert.equal(p.media.type,'video/webm');assert.equal(p.ai,true);assert.equal(p.likes,1);assert.equal(p.comments.length,1);
 mutate(s,'a',{action:'editPost',id,caption:'바뀐 이야기',expectedCaption:'처음'},created+5);
 assert.equal(s.posts[0].edited,created+4);assert.equal(s.posts.length,1);
});
test('stale caption editors cannot overwrite newer content and text-only posts cannot become empty',()=>{
 const s=empty(),id=randomUUID();mutate(s,'a',{action:'publish',id,caption:'원본'},100000);
 mutate(s,'a',{action:'editPost',id,caption:'먼저 저장',expectedCaption:'원본'},100001);
 assert.throws(()=>mutate(s,'a',{action:'editPost',id,caption:'오래된 창의 내용',expectedCaption:'원본'},100002),e=>e.status===409);
 assert.throws(()=>mutate(s,'a',{action:'editPost',id,caption:' ',expectedCaption:'먼저 저장'},100003),e=>e.status===400);
 assert.throws(()=>mutate(s,'a',{action:'editPost',id,caption:'가'.repeat(2201),expectedCaption:'먼저 저장'},100004),e=>e.status===400);
 assert.throws(()=>mutate(s,'a',{action:'editPost',id,caption:'확인 없이 수정'},100005),e=>e.status===409);
 assert.equal(s.posts[0].caption,'먼저 저장');
 s.posts[0].moderated=true;assert.throws(()=>mutate(s,'a',{action:'editPost',id,caption:'숨김 우회',expectedCaption:'먼저 저장'},100006),e=>e.status===404);
 s.posts[0].moderated=false;mutate(s,'a',{action:'delete',id},100007);assert.throws(()=>mutate(s,'a',{action:'editPost',id,caption:'복구 우회',expectedCaption:'먼저 저장'},100008),e=>e.status===404);
});
test('simultaneous editors keep the first committed caption through the actual atomic update',async()=>{
 const id=randomUUID(),initial=empty();mutate(initial,'a',{action:'publish',id,caption:'원본'},100000);
 let value=initial,etag=1;const store={async getWithMetadata(){return {data:structuredClone(value),etag:String(etag)};},async setJSON(k,v,opt){if(opt.onlyIfMatch!==String(etag))return {modified:false};value=structuredClone(v);etag++;return {modified:true};}};
 const edits=await Promise.allSettled(['첫 번째','두 번째'].map(caption=>update(store,'a',{action:'editPost',id,caption,expectedCaption:'원본'})));
 assert.equal(edits.filter(r=>r.status==='fulfilled').length,1);assert.equal(edits.find(r=>r.status==='rejected').reason.status,409);assert.equal(value.posts[0].caption,'첫 번째');
});
