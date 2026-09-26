/** Netlify-specific gate. Never trust Sites identity headers on this host.
 * Enable generation only after implementing verified user sessions and spend limits.
 * Photo editing/export remains entirely client-side and available now.
 */
export default async function handler(request) {
 const headers={'Cache-Control':'no-store','Content-Type':'application/json'};
 const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(request.method==='GET'&&!new URL(request.url).searchParams.has('id'))return respond({image:false,video:false,instagram:false,deployment:'netlify',reason:'GENERATION_NOT_CONNECTED'});
 if(request.method==='POST'||request.method==='GET')return respond({error:'AI 생성 서비스와 이용자 인증이 아직 연결되지 않았습니다. 내 사진으로 이미지·사진 영상을 만들 수 있습니다.',code:'NOT_CONFIGURED'},503);
 return respond({error:'지원하지 않는 요청입니다.'},405);
}
