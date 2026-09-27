import {createHash} from 'node:crypto';
import {getStore} from '@netlify/blobs';
import {json} from './security.mjs';
export const generationStore=()=>getStore({name:'voicegram-generation-v1',consistency:'strong'});
const hash=value=>createHash('sha256').update(value).digest('hex');
export const validRequestId=id=>/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id||'');
const keyFor=(auth,id)=>'requests/'+hash(String(auth.nonce||auth.exp))+'/'+id;
export async function generationFingerprint({prompt,kind,ratio,photo,duration,motion,caption,planId}) {
 return hash(JSON.stringify({prompt,kind,ratio,photo:photo?hash(Buffer.from(await photo.arrayBuffer())):null,...(['video','video-plan'].includes(kind)?{duration,motion,caption:caption||'',planId:planId||null}:{})}));
}
export async function completedGeneration(store,auth,id,fingerprint){
 if(!validRequestId(id))return null;
 const r=await store.get(keyFor(auth,id),{type:'json'});
 return r?.state==='completed'&&r.expires>Date.now()&&r.fingerprint===fingerprint?r.body:null;
}
function result(record,now=Date.now()) {
 if(!record)return json({error:'저장된 요청을 찾지 못했어요. 자동으로 다시 생성하지 않습니다.',state:'missing'},404);
 if(record.expires<now)return json({error:'이 요청의 결과 보관 시간이 지났어요. 기기의 임시 저장을 확인해주세요.',state:'expired'},410);
 if(record.state==='completed')return json({...record.body,state:'completed'});
 if(record.state==='failed')return json({...record.body,state:'failed'},record.status||502);
 if(record.state==='unknown'||now-record.created>90000)return json({error:'제공 서비스의 결과를 확정하지 못했어요. 사용 내역 확인 전에는 새로 생성하지 마세요.',state:'unknown'},409);
 return json({state:'pending',message:'앞선 요청을 처리하고 있어요. 결과 확인으로 다시 확인해주세요.'},202);
}
export async function generationStatus(store,auth,id,now=Date.now()) {
 if(!validRequestId(id))return json({error:'올바른 요청 번호가 필요해요.'},400);
 return result(await store.get(keyFor(auth,id),{type:'json'}),now);
}
/** A request is claimed in durable storage before the chargeable provider call. */
export async function generateOnce(store,auth,id,fingerprint,run,now=Date.now()) {
 if(!validRequestId(id))return json({error:'앱을 새로고침한 뒤 다시 시도해주세요.',state:'invalid'},400);
 const key=keyFor(auth,id);
 const record={state:'pending',fingerprint,created:now,expires:Math.min(Number(auth.exp),now+8*3600000)};
 const claim=await store.setJSON(key,record,{onlyIfNew:true,metadata:{expires:record.expires}});
 if(!claim.modified){const existing=await store.get(key,{type:'json'});if(existing&&existing.fingerprint!==fingerprint)return json({error:'앞선 요청과 내용이 달라요. 기존 결과를 먼저 확인해주세요.',state:'conflict'},409);return result(existing,now);}
 let response,body;
 try{response=await run();body=await response.json();}
 catch{body={state:'unknown',error:'요청 결과를 확정하지 못했어요. 자동으로 다시 생성하지 않습니다.'};response={status:502,ok:false};}
 const state=response.ok?'completed':body.state==='unknown'?'unknown':'failed';
 // Keep the claim if persistence fails; repeating the same ID can never call the provider again.
 try{await store.setJSON(key,{...record,state,status:response.status,body},{metadata:{expires:record.expires}});}
 catch{return json({error:'생성 결과 보관을 확인하지 못했어요. 다시 생성하지 말고 결과 확인을 눌러주세요.',state:'unknown'},503);}
 return json({...body,state},response.status);
}
