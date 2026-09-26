import {randomBytes,timingSafeEqual} from 'node:crypto';
import {json,guard,session,sign} from './_shared/security.mjs';
import {store} from './_shared/storage.mjs';
export default async function handler(req){try{
 if(['GET','HEAD'].includes(req.method)){const u=new URL(req.url),id=u.searchParams.get('id'),exp=Number(u.searchParams.get('exp')),sig=u.searchParams.get('sig')||'';if(!/^[a-f0-9]{48}$/.test(id||'')||exp<Date.now()||exp>Date.now()+3600000||sig.length!==64)return json({error:'파일 링크가 만료됐습니다.'},403);const expected=sign('asset:'+id+':'+exp);if(!timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return json({error:'잘못된 파일 링크입니다.'},403);const meta=await store().get('asset-info/'+id,{type:'json'});if(!meta||meta.exp!==exp)return json({error:'파일이 없습니다.'},404);const data=req.method==='HEAD'?null:await store().get('asset/'+id,{type:'stream'});return new Response(data,{headers:{'Content-Type':meta.type,'Cache-Control':'private, max-age=0','X-Content-Type-Options':'nosniff'}});}
 const blocked=guard(req);if(blocked)return blocked;if(req.method!=='POST')return json({error:'지원하지 않는 요청입니다.'},405);
 if(Number(req.headers.get('content-length')||0)>4500000)return json({error:'파일은 4MB 이하여야 합니다. 큰 영상은 저장 후 인스타에서 직접 올려주세요.'},413);
 const f=await req.formData(),file=f.get('file');if(!(file instanceof Blob)||file.size>4000000||!['image/jpeg','video/mp4'].includes(file.type))return json({error:'4MB 이하 JPG 또는 MP4 파일이 필요합니다. WebM은 파일 저장 후 변환해주세요.'},400);
 const data=Buffer.from(await file.arrayBuffer());if(file.type==='image/jpeg'&&(data[0]!==255||data[1]!==216)||file.type==='video/mp4'&&data.subarray(4,8).toString()!=='ftyp')return json({error:'파일 형식을 확인해주세요.'},400);
 const id=randomBytes(24).toString('hex'),exp=Date.now()+3600000;await store().set('asset/'+id,data);await store().setJSON('asset-info/'+id,{exp,type:file.type,owner:session(req).nonce});return json({assetId:id,expiresAt:exp});
 }catch{return json({error:'게시 파일을 준비하지 못했습니다.'},502);}}
