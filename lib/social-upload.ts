export const VIDEO_UPLOAD_LIMIT=20_000_000,VIDEO_CHUNK_BYTES=2_000_000;
type UploadOptions={timeoutMs?:number;retryDelayMs?:number};
export async function uploadSocialVideo(file:Blob,id:string,onProgress:(n:number)=>void,request:typeof fetch=fetch,options:UploadOptions={}){
 if(!file.size||file.size>VIDEO_UPLOAD_LIMIT)throw Error('20MB 이하의 영상을 선택해주세요.');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(v=>v.toString(16).padStart(2,'0')).join('');
 // The server deduplicates the same upload and piece, including lost responses.
 async function send(path:string,init:RequestInit):Promise<{complete?:boolean}>{
  for(let attempt=0;;attempt++){
   const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
   try{
    return await Promise.race([
     (async()=>{const response=await request(path,{...init,signal:controller.signal});let data:{error?:string;complete?:boolean};try{data=await response.json();}catch{throw Object.assign(Error('영상 전송 응답을 확인하지 못했어요.'),{status:response.ok?503:response.status});}if(!response.ok)throw Object.assign(Error(data.error||'영상 전송이 중단됐어요. 다시 게시를 눌러주세요.'),{status:response.status});return data;})(),
     new Promise<never>((_,reject)=>{timer=setTimeout(()=>{reject(Error('영상 전송 시간이 초과됐어요. 연결을 확인하고 다시 게시해주세요.'));controller.abort();},options.timeoutMs??30000);})
    ]);
   }catch(error){const status=(error as {status?:number})?.status;if(attempt>=2||status!==undefined&&![408,425,500,502,503,504].includes(status))throw error;}
   finally{if(timer)clearTimeout(timer);}
   await new Promise(resolve=>setTimeout(resolve,(options.retryDelayMs??500)*2**attempt));
  }
 }
 const prepared=await send('/api/social',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'prepareUpload',id,type:file.type,size:file.size,hash})});if(prepared.complete){onProgress(100);return;}
 const count=Math.ceil(file.size/VIDEO_CHUNK_BYTES);for(let i=0;i<count;i++){await send(`/api/social?upload=${encodeURIComponent(id)}&part=${i}`,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file.slice(i*VIDEO_CHUNK_BYTES,(i+1)*VIDEO_CHUNK_BYTES)});onProgress(Math.round((i+1)/count*100));}
}
