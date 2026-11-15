import {atomicUpdate} from './social-core.mjs';
import {env} from './security.mjs';
export async function unlinkKakao(accounts,uid,request=fetch,read=env){
 if(await accounts.get('unlinked/'+uid,{type:'json'}))return;
 const ref=await accounts.get('providers/'+uid,{type:'json'}),key=read('KAKAO_ADMIN_KEY');
 if(!key||!ref?.providerId)throw Object.assign(Error('카카오 연결 해제 설정을 확인하지 못했어요. 운영자에게 문의해주세요.'),{status:503});
 const r=await request('https://kapi.kakao.com/v1/user/unlink',{method:'POST',headers:{Authorization:'KakaoAK '+key,'Content-Type':'application/x-www-form-urlencoded;charset=utf-8'},body:new URLSearchParams({target_id_type:'user_id',target_id:ref.providerId}),signal:AbortSignal.timeout(15000)});
 const d=await r.json();if(!r.ok||String(d.id)!==ref.providerId)throw Object.assign(Error('카카오 연결 해제를 확인하지 못했어요. 삭제를 완료하지 않았습니다.'),{status:502});
 await accounts.setJSON('unlinked/'+uid,{at:Date.now()},{onlyIfNew:true});
}
export function ownRecords(s,uid,now=Date.now()){
 if(s.closed?.[uid])throw Object.assign(Error('삭제된 계정입니다.'),{status:410});
 return {product:'보이스그램',exportedAt:new Date(now).toISOString(),profile:s.profiles[uid]||null,
 posts:s.posts.filter(p=>p.user===uid&&!p.deleted).map(({id,caption,created,media,ai,moderated})=>({id,caption,created,media:media?{type:media.type,url:'/api/social?media='+id}:null,ai:!!ai,hidden:!!moderated})),
 comments:s.comments.filter(c=>c.user===uid),likes:s.likes.filter(l=>l.user===uid),following:s.follows.filter(f=>f.user===uid).map(f=>({target:f.target,created:f.created})),blocked:s.blocks.filter(b=>b.user===uid).map(b=>b.target),reports:s.reports.filter(r=>r.user===uid).map(({id,post,reason,created,status})=>({id,post,reason,created,status})),
 note:'사진·영상 원본은 포함하지 않으며 로그인 상태에서 열 수 있는 링크입니다. 다른 사람의 글·댓글과 신고 내용은 포함하지 않습니다.'};
}
export async function purgeClosedMedia(store,{limit=30,deadline=Date.now()+15000}={}){
 const s=await store.get('community',{type:'json'});if(!s?.closed)return 0;
 let removed=0,visited=0;
 for(const [uid,record]of Object.entries(s.closed))for(const id of record.media||[]){
 if(++visited>limit||Date.now()>deadline)return removed;
 const asset=await store.getMetadata('media/'+id);
 // A delayed cleanup must never remove a new object belonging to somebody else.
 if(asset&&!asset.metadata?.user)continue;
 if(!asset||asset.metadata.user===uid){await store.delete('media/'+id);removed++;}
 await atomicUpdate(store,current=>{if(current.closed?.[uid])current.closed[uid].media=current.closed[uid].media.filter(v=>v!==id);return current;});
 }
 return removed;
}
