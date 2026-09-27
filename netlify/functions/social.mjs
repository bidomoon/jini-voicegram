import {getStore} from '@netlify/blobs';
import {randomUUID,timingSafeEqual,createHmac} from 'node:crypto';
import {guard,env,json} from './_shared/security.mjs';
import {accountSession,deviceIdentity} from './_shared/accounts.mjs';
import {empty,visible,update} from './_shared/social-core.mjs';
const sign=s=>createHmac('sha256',env('SOCIAL_SESSION_SECRET')).update(s).digest('hex');
export default async function(req){
 let account;try{account=await accountSession(req);}catch{return json({error:'로그인 상태를 확인하지 못했어요.'},503);}
 const denied=account?(req.method!=='GET'&&req.headers.get('origin')!==new URL(req.url).origin?json({error:'잘못된 요청 출처입니다.'},403):null):guard(req);if(denied)return denied;
 if((env('SOCIAL_SESSION_SECRET')||'').length<32)return json({error:'커뮤니티 연결 설정을 확인해주세요.'},503);
 if(!['GET','POST'].includes(req.method))return json({error:'지원하지 않는 메서드입니다.'},405);
 const existing=account?.uid||deviceIdentity(req),uid=existing||randomUUID();
 const store=getStore({name:'voicegram-social-beta-v1',consistency:'strong'});
 const respond=(data,status=200)=>{const r=json(data,status);if(!existing){const exp=Date.now()+31536000000;r.headers.append('Set-Cookie',`vg_person=${uid}.${exp}.${sign('person:'+uid+'.'+exp)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`);}return r;};
 try{
 if(req.method==='GET'){
 const state=await store.get('community',{type:'json'})||empty();const data=visible(state,uid),media=new URL(req.url).searchParams.get('media');
 if(media){const p=data.posts.find(p=>p.id===media);if(!p?.media)return json({error:'사진을 찾을 수 없습니다.'},404);const asset=await store.getWithMetadata('media/'+media,{type:'arrayBuffer'});if(!asset)return json({error:'파일을 찾을 수 없습니다.'},404);return new Response(asset.data,{headers:{'Content-Type':asset.metadata.type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
 return respond({...data,authProvider:account?'kakao':'tester'});
 }
 if(Number(req.headers.get('content-length'))>4500000)return respond({error:'파일 크기가 너무 큽니다.'},413);
 let a;
 if(req.headers.get('content-type')?.includes('multipart/form-data')){
 const form=await req.formData();const file=form.get('file');const id=form.get('id');if(!/^[a-f0-9-]{36}$/.test(id||''))return respond({error:'잘못된 게시 요청입니다.'},400);
 a={action:'publish',id,caption:form.get('caption'),ai:form.get('ai')==='true'};
 if(file&&typeof file!=='string'&&file.size){if(file.size>4*1024*1024||!['image/jpeg','image/png','image/webp','video/mp4','video/webm'].includes(file.type))return respond({error:'4MB 이하의 사진 또는 MP4·WebM 영상만 올릴 수 있어요.'},400);const bytes=new Uint8Array(await file.arrayBuffer());const valid=file.type==='image/jpeg'?bytes[0]===255&&bytes[1]===216:file.type==='image/png'?Buffer.from(bytes.subarray(0,8)).equals(Buffer.from([137,80,78,71,13,10,26,10])):file.type==='image/webp'?Buffer.from(bytes.subarray(8,12)).toString()==='WEBP':file.type==='video/mp4'?Buffer.from(bytes.subarray(4,8)).toString()==='ftyp':bytes[0]===26&&bytes[1]===69&&bytes[2]===223&&bytes[3]===163;if(!valid)return respond({error:'파일 형식이 일치하지 않습니다.'},400);
 // Never overwrite another post's media; retries keep the same immutable object.
 const prior=await store.get('community',{type:'json'});const p=prior?.posts.find(p=>p.id===id);if(p&&p.user!==uid)return respond({error:'중복 게시 요청입니다.'},409);
 const mediaKey='media/'+id;const oldMedia=await store.getMetadata(mediaKey);if(oldMedia&&oldMedia.metadata.user!==uid)return respond({error:'중복 파일 요청입니다.'},409);
 const uploaded=await store.set(mediaKey,bytes.buffer,{onlyIfNew:true,metadata:{type:file.type,user:uid}});if(!uploaded.modified&&(await store.getMetadata(mediaKey))?.metadata.user!==uid)return respond({error:'중복 파일 요청입니다.'},409);a.media={type:file.type};
 }
 }else {const raw=await req.text();if(raw.length>10000)return respond({error:'요청이 너무 깁니다.'},413);a=JSON.parse(raw);if(a.action==='publish')return respond({error:'게시 양식을 사용해주세요.'},400);}
 const state=await update(store,uid,a);if(a.action==='delete')await store.delete('media/'+a.id);return respond({...visible(state,uid),authProvider:account?'kakao':'tester'});
 }catch(e){console.error('Social request failed',e.status||500);return respond({error:e.status?e.message:'연결을 확인하지 못했어요. 잠시 후 다시 시도해주세요.'},e.status||500);}
}
