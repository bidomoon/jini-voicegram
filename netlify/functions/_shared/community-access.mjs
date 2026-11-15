import {getStore} from '@netlify/blobs';
import {accountSession,deviceIdentity} from './accounts.mjs';
import {env,guard} from './security.mjs';
import {operatorIdentity} from './operator-policy.mjs';
export const communityStore=()=>getStore({name:'voicegram-social-beta-v1',consistency:'strong'});
export async function communityIdentity(req,accounts,context){
 const account=await accountSession(req,accounts,Date.now(),context);
 const denied=account?(req.method!=='GET'&&req.headers.get('origin')!==new URL(req.url).origin):guard(req);
 if(denied)throw Object.assign(Error('로그인 후 이용해주세요.'),{status:denied===true?403:denied.status});
 if((env('SOCIAL_SESSION_SECRET')||'').length<32)throw Object.assign(Error('커뮤니티 연결을 확인해주세요.'),{status:503});
 const uid=account?.uid||deviceIdentity(req);if(!uid)throw Object.assign(Error('피드를 먼저 열고 다시 시도해주세요.'),{status:401});
 return {uid,provider:account?.provider||'tester',account};
}
export function moderatorIdentity(context,read=env){
 // Netlify verifies context.user. Browser headers, form fields and device IDs cannot grant this role.
 return operatorIdentity(context,read);
}
export async function authorizedModerator(req,context,read=env,accounts){
 const team=moderatorIdentity(context,read);if(team)return team;
 const allowed=(read('VOICEGRAM_MODERATOR_KAKAO_UIDS')||'').split(',').map(s=>s.trim()).filter(Boolean);
 if(!allowed.length)return null;
 const account=await accountSession(req,accounts);return account?.provider==='kakao'&&allowed.includes(account.uid)?'kakao:'+account.uid:null;
}
