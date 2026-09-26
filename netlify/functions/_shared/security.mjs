import {createHmac,createHash,timingSafeEqual} from 'node:crypto';
export const env=k=>globalThis.Netlify?.env?.get(k)??process.env[k];
export const json=(d,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store'}});
export const sign=s=>createHmac('sha256',env('VOICEGRAM_ACCESS_CODE')||'unconfigured').update(s).digest('hex');
const equal=(a,b)=>timingSafeEqual(createHash('sha256').update(String(a)).digest(),createHash('sha256').update(String(b)).digest());
export function session(req){try{if((env('VOICEGRAM_ACCESS_CODE')||'').length<24)return null;const raw=(req.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('vg_session='))?.slice(11);const [payload,sig]=raw.split('.');if(!equal(sign(payload),sig))return null;const d=JSON.parse(Buffer.from(payload,'base64url'));return d.exp>Date.now()?d:null;}catch{return null;}}
export function guard(req){if(!session(req))return json({error:'먼저 AI 대화 시작하기에서 테스트 접근 코드를 입력해주세요.',code:'AUTH_REQUIRED'},401);if(req.method!=='GET'&&req.headers.get('origin')!==new URL(req.url).origin)return json({error:'잘못된 요청 출처입니다.'},403);}
export const ticket=(id)=>sign('video:'+id);
export const validTicket=(id,t)=>typeof t==='string'&&equal(ticket(id),t);
