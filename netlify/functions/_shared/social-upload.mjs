import {createHash} from 'node:crypto';
const MAX=20_000_000,CHUNK=2_000_000;
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const idOk=id=>/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id||'');
const sha=data=>createHash('sha256').update(data).digest('hex');
const key=id=>'uploads/'+id+'/meta';
async function owned(store,uid,id,now){if(!idOk(id))fail('영상 번호를 확인해주세요.');const m=await store.get(key(id),{type:'json'});if(!m||m.user!==uid)fail('내 영상만 전송할 수 있어요.',403);if(m.expires<now)fail('전송 시간이 지났어요. 영상을 다시 선택해주세요.',410);return m;}
export async function prepareUpload(store,uid,a,now=Date.now()){
 if(!idOk(a.id)||!Number.isInteger(a.size)||a.size<12||a.size>MAX||!['video/mp4','video/webm','video/quicktime'].includes(a.type)||!/^[a-f\d]{64}$/.test(a.hash||''))fail('20MB 이하의 MP4·MOV·WebM 영상을 선택해주세요.');
 const m=await store.get(key(a.id),{type:'json'});if(m){await owned(store,uid,a.id,now);if(m.size!==a.size||m.type!==a.type||m.hash!==a.hash)fail('앞서 전송한 영상과 다른 파일입니다. 다시 선택해주세요.',409);return {complete:!!m.complete};}
 const rateKey='upload-limits/'+uid,old=await store.getWithMetadata(rateKey,{type:'json'}),times=(old?.data?.times||[]).filter(t=>now-t<3600000);if(times.length>=12)fail('영상 전송은 한 시간에 12개까지 가능해요.',429);
 if(!(await store.setJSON(rateKey,{times:[...times,now]},old?{onlyIfMatch:old.etag}:{onlyIfNew:true})).modified)fail('앞선 전송이 끝나면 다시 시도해주세요.',409);
 if(await store.getMetadata('media/'+a.id))fail('이미 사용된 게시 요청입니다.',409);
 const expires=now+2*3600000,record={user:uid,size:a.size,type:a.type,hash:a.hash,created:now,expires};if(!(await store.setJSON(key(a.id),record,{onlyIfNew:true,metadata:{expires}})).modified)return prepareUpload(store,uid,a,now);return {complete:false};
}
export async function uploadPart(store,uid,id,index,bytes,now=Date.now()){
 const m=await owned(store,uid,id,now);if(m.complete)return;
 if(!Number.isInteger(index)||index<0||index>=Math.ceil(m.size/CHUNK)||bytes.byteLength!==Math.min(CHUNK,m.size-index*CHUNK))fail('영상 조각의 크기가 맞지 않습니다.');
 const k='uploads/'+id+'/'+index,hash=sha(Buffer.from(bytes));if(!(await store.set(k,bytes,{onlyIfNew:true,metadata:{hash,expires:m.expires}})).modified&&(await store.getMetadata(k))?.metadata.hash!==hash)fail('다른 영상으로 덮어쓸 수 없습니다.',409);
}
export async function finishUpload(store,uid,id,now=Date.now()){
 const m=await owned(store,uid,id,now),k='media/'+id,prior=await store.getMetadata(k);if(prior){if(prior.metadata.user!==uid||prior.metadata.hash!==m.hash)fail('다른 영상으로 덮어쓸 수 없습니다.',409);return {type:m.type};}
 const chunks=[];for(let i=0;i<Math.ceil(m.size/CHUNK);i++){const b=await store.get('uploads/'+id+'/'+i,{type:'arrayBuffer'});if(!b)fail('영상 전송이 끝나지 않았어요. 다시 게시해주세요.',409);chunks.push(Buffer.from(b));}
 const b=Buffer.concat(chunks);if(b.length!==m.size||sha(b)!==m.hash)fail('전송된 영상을 확인하지 못했어요.',409);const valid=m.type==='video/webm'?b[0]===26&&b[1]===69&&b[2]===223&&b[3]===163:b.subarray(4,8).toString()==='ftyp';if(!valid)fail('영상 형식이 맞지 않습니다.');
 const saved=await store.set(k,b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),{onlyIfNew:true,metadata:{user:uid,type:m.type,hash:m.hash}});if(!saved.modified){const other=await store.getMetadata(k);if(other?.metadata.user!==uid||other?.metadata.hash!==m.hash)fail('다른 영상으로 덮어쓸 수 없습니다.',409);}
 await store.setJSON(key(id),{...m,complete:true},{metadata:{expires:m.expires}});return {type:m.type};
}
export async function cleanUploads(store,now=Date.now()){let visited=0,removed=0;const deadline=Date.now()+20000;for await(const page of store.list({prefix:'uploads/',paginate:true}))for(const {key} of page.blobs){if(++visited>500||Date.now()>deadline)return removed;const m=await store.getMetadata(key);if(m?.metadata.expires&&m.metadata.expires<now){await store.delete(key);removed++;}}return removed;}
