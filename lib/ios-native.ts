type NativeBridge={postMessage:(message:Record<string,unknown>)=>void};
type NativeWindow=Window&{webkit?:{messageHandlers?:{voicegram?:NativeBridge}}};
const uuid=/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
export type IOSDraft={id:string;caption:string};
export type IOSSpeech={id:string;phase:'start'|'partial'|'final'|'error'|'end';text:string};
export function isIOSApp(){return typeof window!=='undefined'&&typeof (window as NativeWindow).webkit?.messageHandlers?.voicegram?.postMessage==='function';}
export function postIOS(action:string,values:Record<string,unknown>={}){if(!isIOSApp())return false;try{(window as NativeWindow).webkit!.messageHandlers!.voicegram!.postMessage({...values,action});return true;}catch{return false;}}
export function decodeIOSDraft(value:unknown):IOSDraft|null{
 if(!value||typeof value!=='object')return null;const d=value as Record<string,unknown>;
 return typeof d.id==='string'&&uuid.test(d.id)&&typeof d.caption==='string'&&!!d.caption.trim()&&d.caption.length<=2200?{id:d.id,caption:d.caption}:null;
}
export function decodeIOSSpeech(value:unknown):IOSSpeech|null{
 if(!value||typeof value!=='object')return null;const d=value as Record<string,unknown>;
 return typeof d.id==='string'&&uuid.test(d.id)&&typeof d.phase==='string'&&['start','partial','final','error','end'].includes(d.phase)&&typeof d.text==='string'&&d.text.length<=2200?{id:d.id,phase:d.phase as IOSSpeech['phase'],text:d.text}:null;
}
export function shareIOS(url:string,text:string){if(!isIOSApp())return false;const target=new URL(url,location.href);if(target.protocol!=='https:'||target.origin!==location.origin)return false;return postIOS('share',{url:target.href,text:text.slice(0,2200)});}
export async function saveIOSFile(file:Blob,filename:string){
 if(!isIOSApp())return false;
 if(!file.size||file.size>20_000_000||!filename||filename.length>100||/[\\/\x00-\x1f\x7f]/.test(filename)||filename.startsWith('.'))throw Error('20MB 이하의 파일과 올바른 파일 이름을 확인해주세요.');
 const base64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error('파일을 읽지 못했어요.'));reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.readAsDataURL(file);});
 await new Promise<void>((resolve,reject)=>{
  const id=crypto.randomUUID();const clean=()=>{clearTimeout(timer);window.removeEventListener('voicegram-native-result',result);};
  const result=(event:Event)=>{const data=(event as CustomEvent).detail;if(!data||data.id!==id)return;clean();if(data.ok===true)resolve();else reject(Error(typeof data.error==='string'?data.error:'파일 공유 창을 열지 못했어요.'));};
  const timer=setTimeout(()=>{clean();reject(Error('파일 준비 응답을 받지 못했어요. 다시 시도해주세요.'));},15000);
  window.addEventListener('voicegram-native-result',result);
  if(!postIOS('file.export',{id,filename,base64})){clean();reject(Error('아이폰 파일 공유를 시작하지 못했어요.'));}
 });
 return true;
}
