import {randomBytes,createCipheriv,createDecipheriv,createHash} from 'node:crypto';
import {env,json,guard,session,sign} from './_shared/security.mjs';
import {store} from './_shared/storage.mjs';
const base=()=>`https://graph.instagram.com/${env('INSTAGRAM_API_VERSION')||'v25.0'}/`;
const configured=()=>!!env('INSTAGRAM_APP_ID')&&!!env('INSTAGRAM_APP_SECRET');
const cookie=(req,name)=>(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1);
const key=()=>createHash('sha256').update(env('VOICEGRAM_ACCESS_CODE')).digest();
function seal(d){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key(),iv);const encrypted=Buffer.concat([c.update(JSON.stringify(d)),c.final()]);return Buffer.concat([iv,c.getAuthTag(),encrypted]).toString('base64url');}
function unseal(s){try{const b=Buffer.from(s,'base64url'),d=createDecipheriv('aes-256-gcm',key(),b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return JSON.parse(Buffer.concat([d.update(b.subarray(28)),d.final()]));}catch{return null;}}
const setCookie=(name,value,age)=>`${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${age}`;
function account(req){const a=unseal(cookie(req,'vg_instagram')||'');return a&&a.exp>Date.now()?a:null;}
async function graph(path,token,data){const r=await fetch(base()+path,{method:data?'POST':'GET',headers:{Authorization:'Bearer '+token,...(data?{'Content-Type':'application/x-www-form-urlencoded'}:{})},body:data?new URLSearchParams(data):undefined,signal:AbortSignal.timeout(40000)});const d=await r.json();if(!r.ok||d.error)throw Error(d.error?.code===190?'인스타 인증이 만료됐습니다. 다시 연결해주세요.':'인스타 요청이 거절됐습니다. 계정 권한과 처리 상태를 확인해주세요.');return d;}
export default async function handler(req){const u=new URL(req.url),action=u.searchParams.get('action');
 try{
 if(req.method==='GET'&&action==='callback'){
 const state=unseal(cookie(req,'vg_ig_state')||'');if(!state||state.exp<Date.now()||state.value!==u.searchParams.get('state')||!u.searchParams.get('code'))return json({error:'인스타 연결이 취소되었거나 만료됐습니다. 앱으로 돌아가 다시 연결해주세요.'},400);
 const r=await fetch('https://api.instagram.com/oauth/access_token',{method:'POST',body:new URLSearchParams({client_id:env('INSTAGRAM_APP_ID'),client_secret:env('INSTAGRAM_APP_SECRET'),grant_type:'authorization_code',redirect_uri:state.redirect,code:u.searchParams.get('code')}),signal:AbortSignal.timeout(40000)});const d=await r.json();if(!r.ok||!d.access_token)throw Error('인스타 로그인 토큰을 받지 못했습니다.');const me=await graph('me?fields=user_id,username',d.access_token);if(me.username?.toLowerCase()!==state.username)throw Error('선택한 계정이 입력한 인스타 아이디와 다릅니다. 다시 연결해주세요.');
 const a={id:String(me.user_id||d.user_id),username:me.username,token:d.access_token,exp:Date.now()+3500000};return new Response(null,{status:303,headers:{Location:'/?instagram=connected','Set-Cookie':setCookie('vg_instagram',seal(a),3500),'Cache-Control':'no-store'}});
 }
 const blocked=guard(req);if(blocked)return blocked;
 if(req.method==='GET'){const a=account(req);return json({configured:configured(),connected:!!a,username:a?.username||null,expiresAt:a?.exp||null});}
 if(req.method!=='POST')return json({error:'지원하지 않는 요청입니다.'},405);
 const b=await req.json();if(!b||typeof b!=='object')return json({error:'잘못된 요청입니다.'},400);
 if(b.action==='connect'){
 if(!configured())return json({error:'Meta 개발자 앱 ID와 시크릿 연결이 필요합니다. 인스타 비밀번호는 이 앱에 입력하지 마세요.'},503);
 const username=String(b.username||'').replace(/^@/,'').toLowerCase();if(!/^[a-z0-9_.]{1,30}$/.test(username))return json({error:'연결할 본인 인스타 아이디를 입력해주세요.'},400);
 const redirect=new URL('/api/instagram?action=callback',u.origin).href,value=randomBytes(24).toString('hex');const auth=new URL('https://www.instagram.com/oauth/authorize');Object.entries({client_id:env('INSTAGRAM_APP_ID'),redirect_uri:redirect,response_type:'code',scope:'instagram_business_basic,instagram_business_content_publish',state:value,enable_fb_login:'0',force_authentication:'1'}).forEach(([k,v])=>auth.searchParams.set(k,v));return new Response(JSON.stringify({url:auth.href}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':setCookie('vg_ig_state',seal({value,username,redirect,exp:Date.now()+600000}),600)}});
 }
 if(b.action==='disconnect')return new Response(JSON.stringify({connected:false}),{headers:{'Content-Type':'application/json','Set-Cookie':setCookie('vg_instagram','',0)}});
 const a=account(req);if(!a)return json({error:'먼저 본인 인스타그램 계정을 연결해주세요.'},401);
 if(b.action==='prepare'){
 if(!/^[a-f0-9]{48}$/.test(b.assetId||''))return json({error:'완성 파일을 먼저 준비해주세요.'},400);const meta=await store().get('asset-info/'+b.assetId,{type:'json'});if(!meta||meta.owner!==session(req).nonce||meta.exp<Date.now())return json({error:'파일이 만료됐습니다. 다시 준비해주세요.'},410);
 const mediaUrl=new URL('/api/media',u.origin);mediaUrl.searchParams.set('id',b.assetId);mediaUrl.searchParams.set('exp',String(meta.exp));mediaUrl.searchParams.set('sig',sign('asset:'+b.assetId+':'+meta.exp));
 // Check Meta can fetch without the user's login. Never disable site protection automatically.
 const probe=await fetch(mediaUrl,{method:'HEAD',redirect:'manual',signal:AbortSignal.timeout(15000)});if(!probe.ok||!probe.headers.get('content-type')?.startsWith(meta.type.split('/')[0]+'/'))return json({error:'사이트 로그인 보호 때문에 인스타가 파일을 가져갈 수 없습니다. 공개 미디어 전달 경로 설정이 필요합니다.'},409);
 if(typeof b.caption!=='string'||b.caption.length>2200)return json({error:'게시글은 2,200자 이내로 입력해주세요.'},400);
 const draftId=randomBytes(24).toString('hex');const d=await graph(a.id+'/media',a.token,meta.type==='image/jpeg'?{image_url:mediaUrl.href,caption:b.caption}:{media_type:'REELS',video_url:mediaUrl.href,caption:b.caption,share_to_feed:'true'});
 await store().setJSON('draft/'+draftId,{container:d.id,account:a.id,username:a.username,owner:session(req).nonce,exp:Date.now()+3600000});return json({draftId,username:a.username,status:'processing'});
 }
 if(!/^[a-f0-9]{48}$/.test(b.draftId||''))return json({error:'게시 준비를 먼저 해주세요.'},400);const draft=await store().get('draft/'+b.draftId,{type:'json'});if(!draft||draft.account!==a.id||draft.owner!==session(req).nonce||draft.exp<Date.now())return json({error:'게시 준비가 만료됐습니다.'},410);
 const state=await graph(draft.container+'?fields=status_code',a.token);
 if(b.action==='status')return json({status:state.status_code,username:a.username});
 if(b.action!=='publish'||b.confirmed!==true||b.username!==a.username)return json({error:'대상 계정과 최종 게시 확인이 필요합니다.'},400);
 const existing=await store().get('published/'+b.draftId,{type:'json'});if(existing)return json(existing);
 if(state.status_code!=='FINISHED')return json({error:state.status_code==='PUBLISHED'?'이미 게시된 요청입니다. 인스타에서 확인해주세요.':'인스타에서 파일을 처리 중이거나 처리에 실패했습니다.',status:state.status_code},409);
 const lock=await store().setJSON('publish-lock/'+b.draftId,{at:Date.now()},{onlyIfNew:true});if(!lock.modified)return json({error:'이미 게시 요청을 보냈습니다. 중복 게시를 막기 위해 인스타에서 결과를 먼저 확인해주세요.'},409);
 const published=await graph(a.id+'/media_publish',a.token,{creation_id:draft.container});const result={published:true,id:published.id,username:a.username};try{const m=await graph(published.id+'?fields=permalink',a.token);result.permalink=m.permalink;}catch{}await store().setJSON('published/'+b.draftId,result);return json(result);
 }catch(e){return json({error:e instanceof Error?e.message:'인스타 연결 처리에 실패했습니다.'},502);}
}
