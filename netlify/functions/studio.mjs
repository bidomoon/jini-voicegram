import {env,json,guard,session} from './_shared/security.mjs';
import {generationStore,generationStatus,generationFingerprint,generateOnce,completedGeneration} from './_shared/generation.mjs';
import {VIDEO_MODEL,videoReady,runway,videoTicket,validVideoTicket,videoOptions,videoPlanReady,videoPlanModel,taskStatus,completedVideo} from './_shared/video.mjs';
const capabilities=()=>({image:!!env('OPENAI_API_KEY')&&env('MEDIA_ENABLED')==='true',video:videoReady(),videoPlan:videoPlanReady(),videoPlanModel:videoPlanModel(),instagram:false,imageModel:env('OPENAI_IMAGE_MODEL')||'gpt-image-1.5',videoModel:VIDEO_MODEL,videoDurations:[5,10],videoAudio:false,videoCreditsPerSecond:12});
export function createStudioHandler({store=generationStore}={}){return async function handler(req){
 const u=new URL(req.url);if(req.method==='GET'&&!u.searchParams.has('id')&&!u.searchParams.has('requestId'))return json({...capabilities(),authenticated:!!session(req)});
 const blocked=guard(req);if(blocked)return blocked;
 try{
 if(req.method==='GET'&&u.searchParams.has('requestId'))return await generationStatus(store(),session(req),u.searchParams.get('requestId'));
 if(req.method==='GET'){
 const id=u.searchParams.get('id');if(!validVideoTicket(req,id,u.searchParams.get('token')))return json({error:'이 영상을 만든 연결에서만 조회할 수 있습니다.'},403);
 if(!capabilities().video)return json({error:'영상 API 연결이 필요합니다.'},503);
 if(u.searchParams.has('download')){const bytes=await completedVideo(req,id,u.searchParams.get('token'));return new Response(new Blob([bytes]).stream(),{headers:{'Content-Type':'video/mp4','Cache-Control':'no-store','Content-Disposition':'attachment; filename="voicegram.mp4"'}});}
 const d=await taskStatus(id);
 return json({id,status:d.status==='SUCCEEDED'?'completed':['FAILED','CANCELED'].includes(d.status)?'failed':'queued',progress:d.status==='SUCCEEDED'?100:0,error:['FAILED','CANCELED'].includes(d.status)?'영상 생성을 완료하지 못했어요. 새 요청 전 사용 내역을 확인해주세요.':undefined});
 }
 if(req.method!=='POST')return json({error:'지원하지 않는 요청입니다.'},405);
 if(Number(req.headers.get('content-length')||0)>4500000)return json({error:'첨부 이미지가 너무 큽니다. 3MB 이하로 줄여주세요.'},413);
 const f=await req.formData();const prompt=String(f.get('prompt')||'').trim(),kind=f.get('kind');if((!prompt&&kind!=='video')||prompt.length>2000||!['image','video'].includes(kind)||f.get('confirmed')!=='true')return json({error:'생성할 내용과 비용 확인이 필요합니다.'},400);
 if(!capabilities()[kind])return json({error:kind==='video'?'AI 동작 영상 서비스가 아직 연결되지 않았습니다. 확대 효과 영상으로 대신 만들지 않습니다.':'이미지 생성이 활성화되지 않았습니다.'},503);
 const photo=f.get('photo');if(photo&&(!(photo instanceof Blob)||photo.size>3000000||!['image/jpeg','image/png','image/webp'].includes(photo.type)))return json({error:'3MB 이하 JPG·PNG·WebP 참조 사진이 필요합니다.'},400);
 if(kind==='video'&&!photo)return json({error:'움직일 원본 사진을 먼저 넣어주세요.'},400);
 let options;try{options=kind==='video'?videoOptions(f):null;}catch(e){return json({error:e.message},400);}
 const requestId=String(f.get('requestId')||''),caption=String(f.get('caption')||'').trim(),planId=String(f.get('planId')||'');
 let plan;
 if(kind==='video'){
  const planFingerprint=await generationFingerprint({kind:'video-plan',prompt,caption,photo,...options});
  const saved=await completedGeneration(store(),session(req),planId,planFingerprint);plan=saved?.plan;
  if(!plan||plan.videoRequestId!==requestId)return json({error:'사진·게시글·동작에 맞는 설계를 먼저 확인해주세요. 이 설계의 기존 영상 요청만 사용할 수 있어요.'},400);
 }
 const fingerprint=await generationFingerprint({prompt,kind,ratio:String(f.get('ratio')||'4:5'),photo,...options,caption,planId});
 return await generateOnce(store(),session(req),requestId,fingerprint,async()=>{
 try{
 if(kind==='video'){const body={model:VIDEO_MODEL,promptText:plan.prompt,ratio:options.ratio==='16:9'?'1280:720':'720:1280',duration:options.duration,promptImage:`data:${photo.type};base64,${Buffer.from(await photo.arrayBuffer()).toString('base64')}`};const r=await runway('image_to_video',{method:'POST',body:JSON.stringify(body)});if(!r.ok)return json({error:r.status===401?'영상 API 인증을 확인해주세요.':r.status===429?'영상 이용 한도나 잔액을 확인해주세요.':'영상 요청이 거절됐습니다. 사용 내역을 확인한 후 다시 시도해주세요.'},502);const d=await r.json();if(!d.id)throw Error();return json({id:d.id,token:videoTicket(d.id,session(req)),status:'queued',duration:options.duration,model:VIDEO_MODEL,audio:false});}
 const params={model:capabilities().imageModel,prompt,n:1,size:f.get('ratio')==='1:1'?'1024x1024':'1024x1536',quality:'low',output_format:'jpeg'};
 let body,headers={Authorization:`Bearer ${env('OPENAI_API_KEY')}`};if(photo){body=new FormData();for(const [k,v]of Object.entries(params))body.set(k,String(v));body.set('image',photo,'reference.'+(photo.type==='image/jpeg'?'jpg':photo.type.split('/')[1]));}else{body=JSON.stringify(params);headers['Content-Type']='application/json';}
 const r=await fetch('https://api.openai.com/v1/images/'+(photo?'edits':'generations'),{method:'POST',headers,body,signal:AbortSignal.timeout(52000)});if(!r.ok){const d=await r.json().catch(()=>({}));return json({error:r.status===401?'이미지 API 키 인증에 실패했습니다.':r.status===429?'이미지 이용 한도나 잔액을 확인해주세요.':d.error?.code==='moderation_blocked'?'이 요청은 이미지 서비스에서 허용되지 않았습니다.':'이미지 생성 요청이 거절됐습니다. 모델 접근 권한과 사용 내역을 확인해주세요.'},502);}const d=await r.json();if(!d.data?.[0]?.b64_json)throw Error();return json({image:'data:image/jpeg;base64,'+d.data[0].b64_json});
 }catch{return json({state:'unknown',error:'요청 결과를 확인하지 못했습니다. 중복 과금을 피하려면 사용 내역을 먼저 확인해주세요. 자동 재생성하지 않습니다.'},502);}
 });
 }catch(e){return json({error:e.status?e.message:'요청 상태를 확인하지 못했어요. 생성 요청은 자동 반복하지 않습니다.',state:'unknown'},e.status||503);}
};}
export default createStudioHandler();
