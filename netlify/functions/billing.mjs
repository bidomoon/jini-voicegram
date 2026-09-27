import {getStore} from '@netlify/blobs';
import {env,json} from './_shared/security.mjs';
import {accountSession} from './_shared/accounts.mjs';
import {billingConfig,newTestOrder,confirmTestOrder} from './_shared/billing.mjs';
export default async function(req){
 const cfg=billingConfig();
 if(req.method==='GET')return json({ready:cfg.ready,mode:'test',liveEnabled:false});
 if(req.method!=='POST')return json({error:'지원하지 않는 요청입니다.'},405);
 const origin=env('APP_ORIGIN')||'https://jini-voicegram.netlify.app';
 if(req.headers.get('origin')!==origin||new URL(req.url).origin!==origin)return json({error:'요청 출처를 확인해주세요.'},403);
 if(!cfg.ready)return json({error:'토스페이 결제 연결을 준비하고 있어요. 아직 결제되지 않습니다.'},503);
 try{
 const user=await accountSession(req);if(!user)return json({error:'카카오로 로그인한 뒤 이용해주세요.',code:'AUTH_REQUIRED'},401);
 const raw=await req.text();if(raw.length>3000)return json({error:'요청이 너무 큽니다.'},413);const body=JSON.parse(raw);if(!body||typeof body!=='object')return json({error:'올바른 요청이 필요합니다.'},400);
 const store=getStore({name:'voicegram-billing-test-v1',consistency:'strong'});
 if(body.action==='order'){const order=await newTestOrder(store,user.uid,body.requestId);return json({orderId:order.orderId,orderName:order.name,amount:order.amount,currency:order.currency,customerKey:user.uid,clientKey:cfg.clientKey,variantKey:cfg.variantKey,successUrl:origin+'/?payment=success',failUrl:origin+'/?payment=fail',mode:'test'});}
 if(body.action==='confirm')return json(await confirmTestOrder({store,uid:user.uid,input:body,secretKey:cfg.secretKey}));
 return json({error:'지원하지 않는 요청입니다.'},400);
 }catch(e){return json({error:e.status?e.message:'결제 연결을 확인하지 못했어요. 잠시 후 다시 확인해주세요.'},e.status||503);}
}
