export const VIDEO_UPLOAD_LIMIT=20_000_000,VIDEO_CHUNK_BYTES=2_000_000;
export async function uploadSocialVideo(file:Blob,id:string,onProgress:(n:number)=>void,request:typeof fetch=fetch){
 if(!file.size||file.size>VIDEO_UPLOAD_LIMIT)throw Error('20MB 이하의 영상을 선택해주세요.');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))).map(v=>v.toString(16).padStart(2,'0')).join('');
 const r=await request('/api/social',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'prepareUpload',id,type:file.type,size:file.size,hash})});const d=await r.json() as {error?:string;complete?:boolean};if(!r.ok)throw Error(d.error||'전송을 시작하지 못했어요.');if(d.complete){onProgress(100);return;}
 const count=Math.ceil(file.size/VIDEO_CHUNK_BYTES);for(let i=0;i<count;i++){const r=await request(`/api/social?upload=${encodeURIComponent(id)}&part=${i}`,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file.slice(i*VIDEO_CHUNK_BYTES,(i+1)*VIDEO_CHUNK_BYTES)});if(!r.ok){const d=await r.json() as {error?:string};throw Error(d.error||'영상 전송이 중단됐어요. 다시 게시를 눌러주세요.');}onProgress(Math.round((i+1)/count*100));}
}
