import {randomUUID} from 'node:crypto';
import {env} from './security.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export function billingConfig(read=env){const clientKey=read('TOSS_TEST_CLIENT_KEY')||'',secretKey=read('TOSS_TEST_SECRET_KEY')||'';return {clientKey,secretKey,variantKey:read('TOSS_VARIANT_KEY')||'DEFAULT',ready:read('PAYMENTS_TEST_ENABLED')==='true'&&/^test_gck_/.test(clientKey)&&/^test_gsk_/.test(secretKey),mode:'test'};}
export async function newTestOrder(store,uid,requestId,now=Date.now()){
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(requestId||''))fail('올바른 주문 요청이 필요합니다.');
 const key='orders/'+uid+'/'+requestId,old=await store.get(key,{type:'json'});if(old)return old;
 const rate=await store.getWithMetadata('limits/'+uid,{type:'json'});const recent=(rate?.data?.times||[]).filter(t=>now-t<3600000);if(recent.length>=10)fail('테스트 주문은 한 시간에 10번까지 만들 수 있어요.',429);const lock=await store.setJSON('limits/'+uid,{times:[...recent,now]},rate?{onlyIfMatch:rate.etag}:{onlyIfNew:true});if(!lock.modified)fail('앞선 주문 요청이 끝나면 다시 시도해주세요.',409);
 const order={id:requestId,uid,orderId:'vg_'+requestId.replaceAll('-',''),name:'보이스그램 결제 연동 테스트',amount:100,currency:'KRW',status:'created',mode:'test',created:now,expires:now+600000};
 await store.setJSON(key,order,{onlyIfNew:true});return await store.get(key,{type:'json'});
}
export function orderRequestId(orderId){if(!/^vg_[a-f0-9]{32}$/.test(orderId||''))fail('주문번호를 확인해주세요.');const v=orderId.slice(3);return `${v.slice(0,8)}-${v.slice(8,12)}-${v.slice(12,16)}-${v.slice(16,20)}-${v.slice(20)}`;}
export function verifyPayment(order,payment,key){return payment.orderId===order.orderId&&payment.paymentKey===key&&payment.status==='DONE'&&payment.totalAmount===order.amount&&payment.currency==='KRW';}
export async function confirmTestOrder({store,uid,input,secretKey,request=fetch,now=Date.now()}){
 if(!/^test_gsk_/.test(secretKey))fail('테스트 결제만 지원합니다.',503);
 const id=orderRequestId(input.orderId),path='orders/'+uid+'/'+id,record=await store.getWithMetadata(path,{type:'json'}),order=record?.data;
 if(!order||order.uid!==uid)fail('내 주문을 찾을 수 없습니다.',404);
 if(!Number.isSafeInteger(input.amount)||input.amount!==order.amount)fail('주문 금액이 일치하지 않습니다.');
 if(typeof input.paymentKey!=='string'||input.paymentKey.length<6||input.paymentKey.length>200)fail('결제 정보를 확인해주세요.');
 if(order.paymentKey&&order.paymentKey!==input.paymentKey)fail('다른 결제 정보로는 재시도할 수 없습니다.',409);
 if(order.status==='paid')return {orderId:order.orderId,paid:true,mode:'test',amount:order.amount};
 if(order.status==='confirming'&&now-order.attempted<45000)fail('결제 결과를 확인 중입니다. 잠시 후 다시 확인해주세요.',409);
 if(order.status==='created'&&order.expires<now)fail('테스트 주문이 만료됐어요. 새로 시작해주세요.',410);
 const attempt=randomUUID();const lock=await store.setJSON(path,{...order,status:'confirming',attempt,attempted:now,paymentKey:input.paymentKey},{onlyIfMatch:record.etag});if(!lock.modified)fail('앞선 요청을 확인하고 있어요. 잠시 후 다시 확인해주세요.',409);
 const headers={Authorization:'Basic '+Buffer.from(secretKey+':').toString('base64'),'Content-Type':'application/json'};
 try{
 // Reconcile an uncertain prior result instead of initiating a second approval.
 const retry=order.status==='pending'||order.status==='confirming';
 const url=retry?'https://api.tosspayments.com/v1/payments/'+encodeURIComponent(input.paymentKey):'https://api.tosspayments.com/v1/payments/confirm';
 const r=await request(url,{method:retry?'GET':'POST',headers:{...headers,...(!retry?{'Idempotency-Key':order.orderId}:{})},...(!retry?{body:JSON.stringify({paymentKey:input.paymentKey,orderId:order.orderId,amount:order.amount})}:{}),signal:AbortSignal.timeout(20000)});
 const payment=await r.json();if(!r.ok||!verifyPayment(order,payment,input.paymentKey))throw Error('Unverified result');
 const latest=await store.getWithMetadata(path,{type:'json'});if(latest?.data.attempt!==attempt)fail('다른 확인 요청이 진행 중입니다.',409);
 const saved=await store.setJSON(path,{...latest.data,status:'paid',confirmed:Date.now()},{onlyIfMatch:latest.etag});if(!saved.modified)fail('결과 저장을 확인 중입니다. 다시 확인해주세요.',409);
 return {orderId:order.orderId,paid:true,mode:'test',amount:order.amount};
 }catch(e){const latest=await store.getWithMetadata(path,{type:'json'});if(latest?.data.attempt===attempt&&latest.data.status!=='paid')await store.setJSON(path,{...latest.data,status:'pending'},{onlyIfMatch:latest.etag});if(e.status)throw e;fail('승인 결과가 확인되지 않았어요. 다시 결제하지 말고 결과 확인을 눌러주세요.',502);}
}
