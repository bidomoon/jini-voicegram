// Adapted from Seniorgram's media-actions.js. Success is never inferred from a download request.
type Writable={write:(blob:Blob)=>Promise<void>;close:()=>Promise<void>;abort:()=>Promise<void>};
type SavePicker=(options:{suggestedName:string;types:{description:string;accept:Record<string,string[]>}[]})=>Promise<{createWritable:()=>Promise<Writable>}>;
type Environment={navigator:Pick<Navigator,'share'|'canShare'>;window:{showSaveFilePicker?:SavePicker;isSecureContext?:boolean};download:(blob:Blob,name:string)=>void};
type Outcome={state:'busy'|'invalid'|'unsupported'|'selected'|'cancelled'|'failed'|'saved'|'requested';message:string};
const extensions:Record<string,string[]>={'image/png':['.png'],'image/jpeg':['.jpg'],'image/webp':['.webp'],'video/mp4':['.mp4'],'video/webm':['.webm'],'video/quicktime':['.mov']};
export function createMediaActions(environment:Environment){
 let busy=false;
 return async function act(action:'save'|'share',blob:Blob,name:string):Promise<Outcome>{
  if(busy)return {state:'busy',message:'열려 있는 저장·공유창을 먼저 마쳐주세요.'};
  const type=blob?.type?.split(';')[0].toLowerCase();
  if(!(blob instanceof Blob)||!blob.size||blob.size>20_000_000||!extensions[type])return {state:'invalid',message:'20MB 이하의 완성 이미지나 영상을 먼저 준비해주세요.'};
  const base=String(name||'보이스그램').normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g,'-').replace(/\.[^.]*$/,'').replace(/^\.+/,'').trim().slice(0,70)||'보이스그램';
  const filename=base+extensions[type][0];busy=true;let writable:Writable|undefined;
  try{
   if(action==='share'){
    const file=new File([blob],filename,{type});
    if(!environment.navigator.share||!environment.navigator.canShare?.({files:[file]}))return {state:'unsupported',message:'이 브라우저는 파일 공유를 지원하지 않아요. 파일로 저장한 뒤 카카오톡에서 첨부해주세요.'};
    // Called directly from a button, before any asynchronous file preparation.
    await environment.navigator.share({files:[file]});
    return {state:'selected',message:'공유창에서 선택을 마쳤어요. 실제 전송 결과는 선택한 앱에서 확인해주세요.'};
   }
   const picker=environment.window.showSaveFilePicker;
   if(picker&&environment.window.isSecureContext!==false){
    const handle=await picker.call(environment.window,{suggestedName:filename,types:[{description:'보이스그램 작품',accept:{[type]:extensions[type]}}]});
    writable=await handle.createWritable();await writable.write(blob);await writable.close();writable=undefined;
    return {state:'saved',message:'선택한 위치에 파일을 저장했어요.'};
   }
   environment.download(blob,filename);
   return {state:'requested',message:'파일 저장을 요청했어요. 다운로드 또는 파일 앱에서 확인해주세요. 사진첩에 자동으로 들어가지 않을 수 있어요.'};
  }catch(error){
   if(writable)try{await writable.abort();}catch{}
   if(error instanceof Error&&error.name==='AbortError')return {state:'cancelled',message:'저장·공유를 취소했어요. 작품은 그대로 남아 있어요.'};
   return {state:'failed',message:action==='share'?'공유창을 열지 못했어요. 파일로 저장한 뒤 카카오톡에서 첨부해주세요.':'파일을 저장하지 못했어요. 작품을 닫지 말고 다시 저장하거나 공유창을 이용해주세요.'};
  }finally{busy=false;}
 };
}
