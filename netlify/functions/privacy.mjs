import {getStore} from '@netlify/blobs';
import {env,json} from './_shared/security.mjs';
import {accountStore,cookieHeader} from './_shared/accounts.mjs';
import {communityStore,communityIdentity} from './_shared/community-access.mjs';
import {empty,update} from './_shared/social-core.mjs';
import {ownRecords,purgeClosedMedia,unlinkKakao} from './_shared/privacy.mjs';
import {finalizeClosedAccount} from './_shared/account-lifecycle.mjs';
export function createPrivacyHandler({socialFactory=communityStore,secondaryFactory,accountsFactory=accountStore,request=fetch,read=env}={}){return async(req,context)=>{
 try{
 if(!['GET','POST'].includes(req.method))return json({error:'지원하지 않는 요청입니다.'},405);
 const accounts=accountsFactory(),identity=await communityIdentity(req,accounts,context),s=socialFactory();
 if(req.method==='GET'){
 if(new URL(req.url).searchParams.get('status')==='1'){const ref=identity.provider==='kakao'?await accounts.get('providers/'+identity.uid,{type:'json'}):null;return json({canDelete:identity.provider!=='kakao'||!!(read('KAKAO_ADMIN_KEY')&&ref?.providerId)});}
 const state=await s.get('community',{type:'json'})||empty();
 const data=ownRecords(state,identity.uid);if(secondaryFactory&&identity.provider==='netlify'){const secondary=await secondaryFactory().get('community',{type:'json'});if(secondary&&!secondary.closed?.[identity.uid])data.verificationRecords=ownRecords(secondary,identity.uid);}const r=json(data);r.headers.set('Content-Disposition','attachment; filename="voicegram-my-records.json"');return r;
 }
 const raw=await req.text();if(raw.length>1000)return json({error:'요청이 너무 큽니다.'},413);const a=JSON.parse(raw);
 if(a.action!=='closeAccount'||a.confirm!=='내 계정 삭제')return json({error:'삭제 확인 문구를 입력해주세요.'},400);
 if(identity.provider==='kakao')await unlinkKakao(accounts,identity.uid,request,read);
 // Persist a no-resurrection marker atomically with the removal of all community records.
 const stores=[s,...(secondaryFactory?[secondaryFactory()]:[])];
 for(const space of stores){const current=await space.get('community',{type:'json'});if(!current?.closed?.[identity.uid])await update(space,identity.uid,{action:'closeAccount',confirm:a.confirm,requestId:a.requestId});}
 let accountCleanupPending=false;
 if(identity.provider!=='tester'){await accounts.setJSON('closed/'+identity.uid,{at:Date.now()},{onlyIfNew:true});try{await finalizeClosedAccount(accounts,identity.uid);}catch{accountCleanupPending=true;}}
 let pending=false;for(const space of stores){try{await purgeClosedMedia(space,{limit:5,deadline:Date.now()+2500});pending=!!(await space.get('community',{type:'json'}))?.closed?.[identity.uid]?.media?.length||pending;}catch{pending=true;}}
 const r=json({closed:true,mediaCleanupPending:pending,accountCleanupPending});for(const name of ['vg_account','vg_session','vg_person'])r.headers.append('Set-Cookie',cookieHeader(name,'',0));return r;
 }catch(e){return json({error:e.status?e.message:'처리 결과를 확인하지 못했어요. 다시 시도해주세요.'},e.status||503);}
};}
export default createPrivacyHandler({secondaryFactory:()=>getStore({name:'voicegram-selftest-v1',consistency:'strong'})});
