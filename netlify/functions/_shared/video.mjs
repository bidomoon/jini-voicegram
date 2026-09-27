import {env,sign,session} from './security.mjs';
import {timingSafeEqual} from 'node:crypto';
export const VIDEO_MODEL='gen4.5';
export const VIDEO_MAX_BYTES=20_000_000;
export const videoReady=()=>!!env('RUNWAYML_API_SECRET')&&env('MEDIA_ENABLED')==='true';
export const runway=(path,options={})=>fetch('https://api.dev.runwayml.com/v1/'+path,{...options,headers:{Authorization:`Bearer ${env('RUNWAYML_API_SECRET')}`,'X-Runway-Version':'2024-11-06','Content-Type':'application/json'},signal:options.signal||AbortSignal.timeout(45000)});
export const videoTicket=(id,auth)=>sign('video-owner:'+id+':'+String(auth.nonce||auth.exp));
export function validVideoTicket(req,id,token){const auth=session(req);if(!auth||typeof token!=='string'||!/^[a-zA-Z0-9-]{8,100}$/.test(id||''))return false;const expected=videoTicket(id,auth);return token.length===expected.length&&timingSafeEqual(Buffer.from(token),Buffer.from(expected));}
export const motions={
 natural:'The subject moves naturally with subtle independent body and environmental movement.',
 perform:'The musician actively plays the instrument shown in the reference. Hands and fingers articulate naturally in coordination with the instrument. For a bowed string instrument, the bow arm moves smoothly back and forth across the strings while the other hand fingers the notes. Gentle expressive body movement.',
 greet:'The person smiles naturally, raises one hand and gives a gentle wave, with natural facial and hand motion.',
 walk:'The person walks naturally with coordinated alternating steps and arm movement. Preserve the original person and setting.',
 custom:''
};
export function videoOptions(form){
 const duration=Number(form.get('duration')||5),motion=String(form.get('motion')||'custom'),ratio=String(form.get('ratio')||'9:16');
 if(![5,10].includes(duration)||!Object.hasOwn(motions,motion)||!['9:16','16:9'].includes(ratio))throw Object.assign(Error('영상은 5초 또는 10초, 세로 또는 가로로 선택해주세요.'),{status:400});
 return {duration,motion,ratio};
}
export const videoPlanReady=()=>!!env('OPENAI_API_KEY')&&env('MEDIA_ENABLED')==='true';
export const videoPlanModel=()=>env('OPENAI_VIDEO_PLAN_MODEL')||env('OPENAI_CHAT_MODEL')||'gpt-4.1-mini';
export async function taskStatus(id){const r=await runway('tasks/'+id,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Object.assign(Error(r.status===401?'영상 API 인증을 확인해주세요.':'영상 상태를 확인하지 못했어요. 새 생성 없이 다시 확인해주세요.'),{status:502});return r.json();}
/** Only provider-returned URLs are fetched; callers cannot supply an arbitrary URL. */
export async function completedVideo(req,id,token){
 if(!validVideoTicket(req,id,token))throw Object.assign(Error('이 영상을 만든 연결에서만 가져올 수 있어요.'),{status:403});
 if(!videoReady())throw Object.assign(Error('AI 영상 서비스 연결이 필요합니다.'),{status:503});
 const task=await taskStatus(id);if(task.status!=='SUCCEEDED'||!task.output?.[0])throw Object.assign(Error('영상이 아직 완성되지 않았어요.'),{status:409});
 const url=new URL(task.output[0]);if(url.protocol!=='https:'||url.username||url.password)throw Error('Invalid video output');
 const r=await fetch(url,{signal:AbortSignal.timeout(40000)});if(!r.ok||Number(r.headers.get('content-length'))>VIDEO_MAX_BYTES)throw Object.assign(Error('완성 영상을 가져오지 못했거나 20MB를 넘었어요.'),{status:413});
 const reader=r.body.getReader(),parts=[];let size=0;
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>VIDEO_MAX_BYTES){await reader.cancel();throw Object.assign(Error('완성 영상이 20MB를 넘었어요. 파일로 보관해주세요.'),{status:413});}parts.push(value);}}finally{reader.releaseLock();}
 const bytes=Buffer.concat(parts);if(bytes.subarray(4,8).toString()!=='ftyp')throw Object.assign(Error('완성 영상 형식을 확인하지 못했어요.'),{status:502});
 return bytes;
}
