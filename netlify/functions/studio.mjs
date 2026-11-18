import {imageProviders,resolveImageProvider} from './_shared/image-provider.mjs';
import {json,guard,session} from './_shared/security.mjs';
import {generationStore,generationStatus,generationFingerprint,generateOnce,completedGeneration} from './_shared/generation.mjs';
import {VIDEO_MODEL,videoReady,videoJobReady,startVideo,videoTicket,validVideoTicket,videoOptions,videoPlanReady,videoPlanModel,taskStatus,completedVideo} from './_shared/video.mjs';
const capabilities=(registry=imageProviders)=>({image:resolveImageProvider(registry).ready,imageProvider:resolveImageProvider(registry).id,imageProviders:Object.keys(registry),video:videoReady(),videoPlan:videoPlanReady(),videoPlanModel:videoPlanModel(),instagram:false,imageModel:resolveImageProvider(registry).model,videoProvider:'higgsfield',videoModel:VIDEO_MODEL,videoDurations:[5,10],videoResolution:'720p',videoAspectRatio:'original',videoAudio:false,videoPricingUrl:'https://open.higgsfield.ai/pricing'});
export function createStudioHandler({store=generationStore,providers=imageProviders}={}){return async function handler(req){
 const u=new URL(req.url);if(req.method==='GET'&&!u.searchParams.has('id')&&!u.searchParams.has('requestId'))return json({...capabilities(providers),authenticated:!!session(req)});
 const blocked=guard(req);if(blocked)return blocked;
 try{
 if(req.method==='GET'&&u.searchParams.has('requestId'))return await generationStatus(store(),session(req),u.searchParams.get('requestId'));
 if(req.method==='GET'){
 const id=u.searchParams.get('id');if(!validVideoTicket(req,id,u.searchParams.get('token')))return json({error:'이 영상을 만든 연결에서만 조회할 수 있습니다.'},403);
 if(!videoJobReady(id))return json({error:'영상 API 연결이 필요합니다.'},503);
 if(u.searchParams.has('download')){const bytes=await completedVideo(req,id,u.searchParams.get('token'));return new Response(new Blob([bytes]).stream(),{headers:{'Content-Type':'video/mp4','Cache-Control':'no-store','Content-Disposition':'attachment; filename="voicegram.mp4"'}});}
 const d=await taskStatus(id);
 return json({id,status:d.status==='SUCCEEDED'?'completed':['FAILED','CANCELED'].includes(d.status)?'failed':'queued',progress:d.status==='SUCCEEDED'?100:0,error:d.moderated?'힉스필드의 콘텐츠 검사로 영상 생성이 중단됐어요. 새 요청 전 사용 내역을 확인해주세요.':['FAILED','CANCELED'].includes(d.status)?'영상 생성을 완료하지 못했어요. 새 요청 전 사용 내역을 확인해주세요.':undefined});
 }
 if(req.method!=='POST')return json({error:'지원하지 않는 요청입니다.'},405);
 if(Number(req.headers.get('content-length')||0)>4500000)return json({error:'첨부 이미지가 너무 큽니다. 3MB 이하로 줄여주세요.'},413);
 const f=await req.formData();const prompt=String(f.get('prompt')||'').trim(),kind=f.get('kind');if((!prompt&&kind!=='video')||prompt.length>2000||!['image','video'].includes(kind)||f.get('confirmed')!=='true')return json({error:'생성할 내용과 비용 확인이 필요합니다.'},400);
 if(!capabilities(providers)[kind])return json({error:kind==='video'?'힉스필드 앱 API 연결이 필요해요. 채팅 플러그인 연결과 별도입니다.':'이미지 생성이 활성화되지 않았습니다.'},503);
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
 const fingerprint=await generationFingerprint({prompt,kind,ratio:String(f.get('ratio')||'4:5'),photo,...options,caption,planId,...(kind==='image'?{providerSignature:resolveImageProvider(providers).id+':'+resolveImageProvider(providers).model+':low'}:{})});
 return await generateOnce(store(),session(req),requestId,fingerprint,async()=>{
 try{
 if(kind==='video'){const job=await startVideo(photo,plan,options);return json({...job,token:videoTicket(job.id,session(req)),status:'queued'});}
 const provider=resolveImageProvider(providers);return json(await provider.adapter.generate({prompt,photo,ratio:String(f.get('ratio')||'4:5')}));
 }catch(e){return json({state:e.status&&!e.uncertain?'failed':'unknown',error:e.status?e.message:'요청 결과를 확인하지 못했습니다. 중복 과금을 피하려면 사용 내역을 먼저 확인해주세요. 자동 재생성하지 않습니다.'},e.status||502);}
 });
 }catch(e){return json({error:e.status?e.message:'요청 상태를 확인하지 못했어요. 생성 요청은 자동 반복하지 않습니다.',state:'unknown'},e.status||503);}
};}
export default createStudioHandler();
