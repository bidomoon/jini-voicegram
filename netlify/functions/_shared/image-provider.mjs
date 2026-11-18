import {env} from './security.mjs';
/** Providers are server-owned adapters. Never accept arbitrary URLs or API keys from the client. */
const openai={
 ready:()=>!!env('OPENAI_API_KEY')&&env('MEDIA_ENABLED')==='true',
 model:()=>env('OPENAI_IMAGE_MODEL')||'gpt-image-1.5',
 async generate({prompt,photo,ratio,fetcher=fetch}){
  const params={model:this.model(),prompt,n:1,size:ratio==='1:1'?'1024x1024':'1024x1536',quality:'low',output_format:'jpeg'};
  const headers={Authorization:`Bearer ${env('OPENAI_API_KEY')}`};let body;
  if(photo){body=new FormData();for(const [key,value] of Object.entries(params))body.set(key,String(value));body.set('image',photo,'reference.'+(photo.type==='image/jpeg'?'jpg':photo.type.split('/')[1]));}
  else{body=JSON.stringify(params);headers['Content-Type']='application/json';}
  const r=await fetcher('https://api.openai.com/v1/images/'+(photo?'edits':'generations'),{method:'POST',headers,body,signal:AbortSignal.timeout(52000)});
  if(!r.ok){const d=await r.json().catch(()=>({}));throw Object.assign(Error(r.status===401?'이미지 API 키 인증에 실패했습니다.':r.status===429?'이미지 이용 한도나 잔액을 확인해주세요.':d.error?.code==='moderation_blocked'?'이 요청은 이미지 서비스에서 허용되지 않았습니다.':'이미지 생성 요청이 거절됐습니다. 모델 접근 권한과 사용 내역을 확인해주세요.'),{status:502,uncertain:false});}
  const d=await r.json();if(!d.data?.[0]?.b64_json)throw Error('이미지 응답을 확인하지 못했습니다.');
  return {image:'data:image/jpeg;base64,'+d.data[0].b64_json};
 }
};
export const imageProviders=Object.freeze({openai});
export function resolveImageProvider(registry=imageProviders){
 const id=env('VOICEGRAM_IMAGE_PROVIDER')||'openai',adapter=Object.hasOwn(registry,id)?registry[id]:null;
 return {id,adapter,ready:!!adapter?.ready(),model:adapter?.model()||null};
}
