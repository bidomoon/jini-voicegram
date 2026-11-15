import {env,json} from './_shared/security.mjs';
import {communityStore,authorizedModerator} from './_shared/community-access.mjs';
import {accountStore} from './_shared/accounts.mjs';
import {atomicUpdate,empty} from './_shared/social-core.mjs';
import {moderate,moderationView} from './_shared/moderation.mjs';
export function createModerationHandler({storeFactory=communityStore,read=env,accountsFactory=accountStore}={}){return async(req,context)=>{
 try{
 const actor=await authorizedModerator(req,context,read,(read('VOICEGRAM_MODERATOR_KAKAO_UIDS')||'').trim()?accountsFactory():undefined);if(!actor)return json({error:'운영자 권한이 필요합니다.'},403);
 const store=storeFactory();
 if(req.method==='GET')return json(moderationView(await store.get('community',{type:'json'})||empty()));
 if(req.method!=='POST')return json({error:'지원하지 않는 요청입니다.'},405);
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'요청 출처를 확인해주세요.'},403);
 const raw=await req.text();if(raw.length>1500)return json({error:'요청이 너무 큽니다.'},413);const a=JSON.parse(raw);
 const state=await atomicUpdate(store,s=>moderate(s,actor,a));return json(moderationView(state));
 }catch(e){return json({error:e.status?e.message:'운영 정보를 확인하지 못했습니다.'},e.status||503);}
};}
export default createModerationHandler();
