import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {env,sign,json} from './security.mjs';

export function inviteReady(read=env){return (read('VOICEGRAM_ACCESS_CODE')||'').length>=24&&(read('SOCIAL_SESSION_SECRET')||'').length>=32;}

// The existing invitation remains the only tester credential. No AI service is involved.
export async function inviteLogin(req){
 if(!inviteReady())return json({error:'초대 연결을 준비하고 있어요. 운영자에게 문의해주세요.'},503);
 const reader=req.body?.getReader();if(!reader)return json({error:'초대 코드를 입력해주세요.'},400);
 const parts=[];let size=0;
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();return json({error:'초대 코드를 확인해주세요.'},413);}parts.push(value);}}finally{reader.releaseLock();}
 let body;try{body=JSON.parse(Buffer.concat(parts).toString());}catch{return json({error:'초대 코드를 확인해주세요.'},400);}
 const code=body?.code;
 const digest=v=>createHash('sha256').update(v).digest();
 if(typeof code!=='string'||code.length>1024||!timingSafeEqual(digest(code),digest(env('VOICEGRAM_ACCESS_CODE'))))return json({error:'초대 코드가 맞지 않아요. 전달받은 코드를 다시 확인해주세요.'},403);
 const payload=Buffer.from(JSON.stringify({exp:Date.now()+8*3600000,nonce:randomBytes(16).toString('hex')})).toString('base64url');
 const r=json({authenticated:true,provider:'tester'});
 r.headers.append('Set-Cookie',`vg_session=${payload}.${sign(payload)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`);
 return r;
}
