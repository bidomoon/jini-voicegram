import {getStore} from '@netlify/blobs';
import {moderatorIdentity} from './_shared/community-access.mjs';
import {json} from './_shared/security.mjs';
import {createSocialHandler} from './social.mjs';
export function createSelftestHandler({store=()=>getStore({name:'voicegram-selftest-v1',consistency:'strong'}),accounts}={}){
 const handler=createSocialHandler({store,accounts,mediaPath:'/api/selftest'});
 return async(req,context)=>{if(!moderatorIdentity(context)||!context?.site?.id)return json({error:'운영자 점검 공간입니다.'},403);return handler(req,context);};
}
export default createSelftestHandler();
