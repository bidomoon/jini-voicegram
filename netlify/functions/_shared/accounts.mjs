import {getStore} from '@netlify/blobs';
import {createHash,createHmac,timingSafeEqual,randomBytes,randomUUID} from 'node:crypto';
import {env} from './security.mjs';
import {operatorIdentity} from './operator-policy.mjs';
export const accountStore=()=>getStore({name:'voicegram-accounts-v1',consistency:'strong'});
export const hash=v=>createHash('sha256').update(v).digest('hex');
export const cookie=(req,name)=>(req.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1)||'';
export const cookieHeader=(name,value,age)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
export const opaque=()=>randomBytes(32).toString('base64url');
export function deviceIdentity(req){try{const [id,expiry,sig]=cookie(req,'vg_person').split('.');if(!/^[a-f0-9-]{36}$/.test(id)||!Number.isFinite(Number(expiry))||Number(expiry)<Date.now())return null;const expected=createHmac('sha256',env('SOCIAL_SESSION_SECRET')).update('person:'+id+'.'+expiry).digest('hex');return sig?.length===expected.length&&timingSafeEqual(Buffer.from(sig),Buffer.from(expected))?id:null;}catch{return null;}}
export async function accountSession(req,store,now=Date.now(),context){const token=cookie(req,'vg_account');if(!/^[\w-]{43}$/.test(token))return null;const data=store||accountStore(),s=await data.get('sessions/'+hash(token),{type:'json'});if(!s||s.exp<=now||await data.get('closed/'+s.uid,{type:'json'}))return null;if(s.provider==='kakao')return s;if(s.provider==='netlify'&&context?.site?.id===s.siteId&&context?.user?.id===s.subject&&operatorIdentity(context,env))return s;return null;}
export async function ownerAccount(store,context){
 if(!operatorIdentity(context,env)||!context?.site?.id)throw Object.assign(Error('운영자 로그인을 확인해주세요.'),{status:403});
 const key='identities/'+hash('netlify:'+context.site.id+':'+context.user.id);
 let account=await store.get(key,{type:'json'});if(!account){await store.setJSON(key,{uid:randomUUID(),provider:'netlify',created:Date.now()},{onlyIfNew:true});account=await store.get(key,{type:'json'});}
 if(!account?.uid)throw Error('Account storage unavailable');await store.setJSON('providers/'+account.uid,{provider:'netlify',identityKey:key,appId:context.site.id},{onlyIfNew:true});return account;
}
export async function providerAccount(store,appId,providerId){if(!/^\d+$/.test(String(providerId)))throw Error('Invalid provider identifier');const key='identities/'+hash('kakao:'+appId+':'+providerId);let account=await store.get(key,{type:'json'});if(!account){await store.setJSON(key,{uid:randomUUID(),provider:'kakao',created:Date.now()},{onlyIfNew:true});account=await store.get(key,{type:'json'});}if(!account?.uid)throw Error('Account storage unavailable');await store.setJSON('providers/'+account.uid,{provider:'kakao',providerId:String(providerId),identityKey:key,appId},{onlyIfNew:true});return account;}
export async function consumeState(store,value,now=Date.now()){const key='oauth/'+hash(value);const record=await store.getWithMetadata(key,{type:'json'});if(!record||record.data.used||record.data.exp<now)return false;const result=await store.setJSON(key,{...record.data,used:true}, {onlyIfMatch:record.etag});return result.modified;}
export function kakaoConfig(read=env){const origin=read('APP_ORIGIN')||'https://jini-voicegram.netlify.app';let valid=false;try{const u=new URL(origin);valid=u.protocol==='https:'&&u.origin===origin;}catch{}return {origin,clientId:read('KAKAO_REST_API_KEY')||'',clientSecret:read('KAKAO_CLIENT_SECRET')||'',ready:valid&&read('KAKAO_LOGIN_ENABLED')==='true'&&!!read('KAKAO_REST_API_KEY')&&!!read('KAKAO_CLIENT_SECRET')};}
