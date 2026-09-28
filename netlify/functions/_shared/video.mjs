import {env,sign,session} from './security.mjs';
import {timingSafeEqual} from 'node:crypto';
export const VIDEO_MODEL='bytedance/seedance-2.0/image-to-video';
export const VIDEO_MAX_BYTES=20_000_000;
const higgsfieldKey=()=>env('HF_API_KEY')||(env('HF_API_KEY_ID')&&env('HF_API_KEY_SECRET')?`${env('HF_API_KEY_ID')}:${env('HF_API_KEY_SECRET')}`:'');
export const videoReady=()=>!!higgsfieldKey()&&env('MEDIA_ENABLED')==='true';
// Existing Runway jobs stay readable; new jobs only go to Higgsfield.
export const videoJobReady=id=>env('MEDIA_ENABLED')==='true'&&(id?.startsWith('hf-')?!!higgsfieldKey():!!env('RUNWAYML_API_SECRET'));
const apiBase='https://api.higgsfield.ai/';
const higgsfield=(path,options={})=>fetch(apiBase+path,{...options,headers:{Authorization:`Key ${higgsfieldKey()}`,'Content-Type':'application/json'},redirect:'error',signal:options.signal||AbortSignal.timeout(15000)});
const providerError=(status,stage)=>Object.assign(Error(status===401||status===403?'힉스필드 API 키와 모델 사용 권한을 확인해주세요.':status===402?'힉스필드 앱 API 잔액을 확인해주세요. 플러그인 크레딧과 별도입니다.':status===429?'힉스필드 이용 한도에 도달했어요. 자동으로 다시 생성하지 않습니다.':status===404||status===423?'힉스필드 모델 사용 권한을 확인해주세요.':`힉스필드 ${stage} 요청이 거절됐어요. 사용 내역 확인 후 다시 시도해주세요.`),{status:502,uncertain:status>=500});
function httpsUrl(value){const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password)throw Error('Invalid provider URL');return url;}
export async function startVideo(photo,plan,options){
 // Shared time budget stays below the function timeout. Never retry a generation POST.
 const signal=AbortSignal.timeout(45000);
 const upload=await higgsfield('files/generate-upload-url',{method:'POST',body:JSON.stringify({content_type:photo.type}),signal});
 if(!upload.ok)throw providerError(upload.status,'사진 업로드');
 const slot=await upload.json(),uploadUrl=httpsUrl(slot.upload_url),publicUrl=httpsUrl(slot.public_url);
 if(!slot.upload_headers||typeof slot.upload_headers!=='object')throw Error('Missing upload headers');
 const headers=new Headers(slot.upload_headers);
 // Storage receives exactly the returned headers, never our API credentials.
 if(headers.has('authorization')||headers.has('cookie'))throw Error('Invalid storage headers');
 const sent=await fetch(uploadUrl,{method:'PUT',headers,body:photo,credentials:'omit',redirect:'error',signal});
 if(!sent.ok)throw Object.assign(Error('사진 업로드를 완료하지 못했어요. 영상 생성은 시작하지 않았습니다.'),{status:502});
 const r=await higgsfield(VIDEO_MODEL,{method:'POST',signal,body:JSON.stringify({image_url:publicUrl.href,prompt:plan.prompt,duration:options.duration,resolution:'720p',generate_audio:false})});
 if(!r.ok)throw providerError(r.status,'영상 생성');
 const d=await r.json();
 if(!/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(d.request_id||''))throw Error('Missing request ID');
 // Status uses the documented request-ID endpoint; no caller URL or auth leaves this origin.
 return {id:'hf-'+d.request_id,duration:options.duration,model:VIDEO_MODEL,provider:'higgsfield',audio:false};
}
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
 const duration=Number(form.get('duration')||5),motion=String(form.get('motion')||'custom'),ratio=String(form.get('ratio')||'original');
 if(![5,10].includes(duration)||!Object.hasOwn(motions,motion)||!['original','9:16','16:9'].includes(ratio))throw Object.assign(Error('영상은 5초 또는 10초로 선택해주세요.'),{status:400});
 return {duration,motion,ratio};
}
export const videoPlanReady=()=>!!env('OPENAI_API_KEY')&&env('MEDIA_ENABLED')==='true';
export const videoPlanModel=()=>env('OPENAI_VIDEO_PLAN_MODEL')||env('OPENAI_CHAT_MODEL')||'gpt-4.1-mini';
export async function taskStatus(id){
 if(!/^[a-zA-Z0-9-]{8,100}$/.test(id||''))throw Object.assign(Error('올바른 영상 번호가 필요해요.'),{status:400});
 const hf=id.startsWith('hf-');
 const r=hf?await higgsfield('requests/'+id.slice(3)+'/status',{signal:AbortSignal.timeout(10000)}):await fetch('https://api.dev.runwayml.com/v1/tasks/'+id,{headers:{Authorization:`Bearer ${env('RUNWAYML_API_SECRET')}`,'X-Runway-Version':'2024-11-06'},redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Object.assign(Error(r.status===401?'영상 API 인증을 확인해주세요.':'영상 상태를 확인하지 못했어요. 새 생성 없이 다시 확인해주세요.'),{status:502});
 const d=await r.json();if(!hf)return d;
 return {status:d.status==='completed'?'SUCCEEDED':['failed','nsfw','canceled'].includes(d.status)?'FAILED':'RUNNING',output:d.video?.url?[d.video.url]:[],moderated:d.status==='nsfw'};
}
/** Only provider-returned URLs are fetched; callers cannot supply an arbitrary URL. */
export async function completedVideo(req,id,token){
 if(!validVideoTicket(req,id,token))throw Object.assign(Error('이 영상을 만든 연결에서만 가져올 수 있어요.'),{status:403});
 if(!videoJobReady(id))throw Object.assign(Error('AI 영상 서비스 연결이 필요합니다.'),{status:503});
 const task=await taskStatus(id);if(task.status!=='SUCCEEDED'||!task.output?.[0])throw Object.assign(Error('영상이 아직 완성되지 않았어요.'),{status:409});
 const url=new URL(task.output[0]);if(url.protocol!=='https:'||url.username||url.password)throw Error('Invalid video output');
 const r=await fetch(url,{signal:AbortSignal.timeout(40000)});if(!r.ok||Number(r.headers.get('content-length'))>VIDEO_MAX_BYTES)throw Object.assign(Error('완성 영상을 가져오지 못했거나 20MB를 넘었어요.'),{status:413});
 const reader=r.body.getReader(),parts=[];let size=0;
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>VIDEO_MAX_BYTES){await reader.cancel();throw Object.assign(Error('완성 영상이 20MB를 넘었어요. 파일로 보관해주세요.'),{status:413});}parts.push(value);}}finally{reader.releaseLock();}
 const bytes=Buffer.concat(parts);if(bytes.subarray(4,8).toString()!=='ftyp')throw Object.assign(Error('완성 영상 형식을 확인하지 못했어요.'),{status:502});
 return bytes;
}
