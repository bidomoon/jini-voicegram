import {getStore} from '@netlify/blobs';
import {json,session as testerSession} from './_shared/security.mjs';
import {accountStore,accountSession,cookie,cookieHeader,opaque,hash,consumeState,providerAccount,kakaoConfig} from './_shared/accounts.mjs';
import {update} from './_shared/social-core.mjs';
export function createAuthHandler({storeFactory=accountStore,socialFactory=()=>getStore({name:'voicegram-social-beta-v1',consistency:'strong'}),request=fetch,config=kakaoConfig}={}){return async req=>{
 const cfg=config(),url=new URL(req.url),action=url.pathname.endsWith('/callback')?'callback':url.searchParams.get('action');
 const redirect=(result,cookies=[])=>{const headers=new Headers({Location:cfg.origin+'/?auth='+result,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});for(const c of cookies)headers.append('Set-Cookie',c);return new Response(null,{status:303,headers});};
 try{
 if(req.method==='GET'&&action!=='callback'){const account=await accountSession(req,storeFactory());return json({kakaoReady:cfg.ready,authenticated:!!account,provider:account?'kakao':testerSession(req)?'tester':null,uid:account?.uid||null});}
 if(action==='callback'&&req.method==='GET'){
 const state=url.searchParams.get('state')||'',expected=cookie(req,'vg_oauth');const clear=cookieHeader('vg_oauth','',0);
 if(!cfg.ready)return redirect('unavailable',[clear]);
 if(!/^[\w-]{43}$/.test(state)||state!==expected||!await consumeState(storeFactory(),state))return redirect('expired',[clear]);
 if(url.searchParams.has('error'))return redirect('cancelled',[clear]);
 const code=url.searchParams.get('code');if(!code||code.length>2048)return redirect('failed',[clear]);
 const response=await request('https://kauth.kakao.com/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:cfg.clientId,client_secret:cfg.clientSecret,redirect_uri:cfg.origin+'/api/auth/callback',code}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)return redirect('failed',[clear]);const token=await response.json();if(typeof token.access_token!=='string')return redirect('failed',[clear]);
 // Provider tokens are used only on the server and never persisted or returned to the browser.
 const me=await request('https://kapi.kakao.com/v2/user/me',{headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(15000)});if(!me.ok)return redirect('failed',[clear]);const identity=await me.json();
 if(!Number.isSafeInteger(identity.id)||identity.id<=0)return redirect('failed',[clear]);
 const accounts=storeFactory(),account=await providerAccount(accounts,cfg.clientId,String(identity.id));
 const social=socialFactory(),current=await social.get('community',{type:'json'});if(!current?.profiles?.[account.uid])await update(social,account.uid,{action:'profile',name:typeof identity.properties?.nickname==='string'?identity.properties.nickname.slice(0,24):'새로운 이웃',emoji:'🙂'});
 const sid=opaque();await accounts.setJSON('sessions/'+hash(sid),{uid:account.uid,provider:'kakao',exp:Date.now()+30*86400000,created:Date.now()},{onlyIfNew:true});
 return redirect('success',[clear,cookieHeader('vg_account',sid,30*86400)]);
 }
 if(req.method!=='POST')return json({error:'지원하지 않는 요청입니다.'},405);
 if(req.headers.get('origin')!==url.origin||url.origin!==cfg.origin)return json({error:'요청 출처를 확인해주세요.'},403);
 if(action==='start'){
 if(!cfg.ready)return json({error:'카카오 간편로그인을 준비하고 있어요. 연결이 완료되면 여기에서 시작할 수 있어요.',code:'KAKAO_NOT_CONFIGURED'},503);
 const state=opaque();await storeFactory().setJSON('oauth/'+hash(state),{exp:Date.now()+600000,used:false},{onlyIfNew:true});const target=new URL('https://kauth.kakao.com/oauth/authorize');target.search=new URLSearchParams({client_id:cfg.clientId,redirect_uri:cfg.origin+'/api/auth/callback',response_type:'code',state,prompt:'select_account'}).toString();
 const r=json({authorizeUrl:target.href});r.headers.append('Set-Cookie',cookieHeader('vg_oauth',state,600));return r;
 }
 if(action==='logout'){const sid=cookie(req,'vg_account');if(/^[\w-]{43}$/.test(sid))await storeFactory().delete('sessions/'+hash(sid));const r=json({loggedOut:true});r.headers.append('Set-Cookie',cookieHeader('vg_account','',0));r.headers.append('Set-Cookie',cookieHeader('vg_session','',0));return r;}
 return json({error:'지원하지 않는 요청입니다.'},400);
 }catch{if(action==='callback')return redirect('failed',[cookieHeader('vg_oauth','',0)]);return json({error:'로그인 연결을 확인하지 못했어요. 잠시 후 다시 시도해주세요.'},503);}
};}
export default createAuthHandler();
