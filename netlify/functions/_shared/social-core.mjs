import {randomUUID} from 'node:crypto';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const text=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
export const empty=()=>({version:1,profiles:{},posts:[],comments:[],likes:[],follows:[],blocks:[],reports:[],rates:{}});
export function mutate(s,uid,a,now=Date.now()){
 if(!s.profiles[uid]){if(Object.keys(s.profiles).length>=500)fail('테스트 참여 인원이 가득 찼습니다.',429);s.profiles[uid]={id:uid,name:'새로운 이웃',bio:'',emoji:'🙂'};}
 const recent=(s.rates[uid]||[]).filter(t=>now-t<60000);if(recent.length>=25)fail('잠시 쉬었다가 다시 시도해주세요.',429);s.rates[uid]=[...recent,now];
 const blocked=id=>s.blocks.some(b=>(b.user===uid&&b.target===id)||(b.user===id&&b.target===uid));
 const post=()=>{const p=s.posts.find(p=>p.id===a.id&&!p.deleted);if(!p||blocked(p.user))fail('게시물을 찾을 수 없습니다.',404);return p;};
 if(a.action==='profile'){const name=text(a.name,24);if(!name)fail('이름을 입력해주세요.');s.profiles[uid]={id:uid,name,bio:text(a.bio,100),emoji:['🙂','🌊','🌷','🐶','☕','🌳','🌙','🦋'].includes(a.emoji)?a.emoji:'🙂'};}
 else if(a.action==='publish'){
 if(!/^[a-f0-9-]{36}$/.test(a.id||''))fail('게시 요청 번호가 올바르지 않습니다.');
 const prior=s.posts.find(p=>p.id===a.id);if(prior){if(prior.user!==uid)fail('게시 요청이 중복되었습니다.',409);return s;}
 if(s.posts.filter(p=>!p.deleted).length>=300)fail('테스트 게시물 한도에 도달했습니다.',429);
 if(s.posts.some(p=>p.user===uid&&now-p.created<15000))fail('새 게시물은 잠시 후 올려주세요.',429);
 const caption=text(a.caption,2200);if(!caption&&!a.media)fail('이야기나 사진을 넣어주세요.');
 s.posts.push({id:a.id,user:uid,caption,created:now,media:a.media||null,ai:!!a.ai});
 }else if(a.action==='delete'){const p=post();if(p.user!==uid)fail('내 게시물만 삭제할 수 있습니다.',403);p.deleted=true;}
 else if(a.action==='like'){post();s.likes=s.likes.filter(v=>!(v.user===uid&&v.post===a.id));if(a.value===true)s.likes.push({user:uid,post:a.id,created:now});}
 else if(a.action==='comment'){post();const body=text(a.body,500);if(!body)fail('댓글을 입력해주세요.');if(s.comments.length>=3000)fail('테스트 댓글 한도에 도달했습니다.',429);if(!/^[a-f0-9-]{36}$/.test(a.requestId||''))fail('댓글 요청 번호가 올바르지 않습니다.');if(!s.comments.some(c=>c.id===a.requestId))s.comments.push({id:a.requestId,post:a.id,user:uid,body,created:now});}
 else if(a.action==='deleteComment'){const c=s.comments.find(c=>c.id===a.id);if(!c||c.user!==uid)fail('내 댓글만 삭제할 수 있습니다.',403);s.comments=s.comments.filter(c=>c.id!==a.id);}
 else if(a.action==='follow'){if(!s.profiles[a.id]||a.id===uid||blocked(a.id))fail('이 프로필을 팔로우할 수 없습니다.');s.follows=s.follows.filter(v=>!(v.user===uid&&v.target===a.id));if(a.value===true)s.follows.push({user:uid,target:a.id,created:now});}
 else if(a.action==='block'){if(!s.profiles[a.id]||a.id===uid)fail('이 프로필을 차단할 수 없습니다.');s.blocks=s.blocks.filter(v=>!(v.user===uid&&v.target===a.id));if(a.value===true)s.blocks.push({user:uid,target:a.id});s.follows=s.follows.filter(v=>!((v.user===uid&&v.target===a.id)||(v.user===a.id&&v.target===uid)));}
 else if(a.action==='report'){post();const reason=text(a.reason,500);if(!reason)fail('신고 사유를 입력해주세요.');if(!s.reports.some(v=>v.user===uid&&v.post===a.id))s.reports.push({id:randomUUID(),user:uid,post:a.id,reason,created:now,status:'received'});}
 else fail('지원하지 않는 요청입니다.');return s;
}
export function visible(s,uid){
 const blocked=id=>s.blocks.some(b=>(b.user===uid&&b.target===id)||(b.user===id&&b.target===uid));
 const profiles=Object.values(s.profiles).filter(p=>!blocked(p.id));
 const posts=s.posts.filter(p=>!p.deleted&&!blocked(p.user)).sort((a,b)=>b.created-a.created).map(p=>({...p,media:p.media?{type:p.media.type,url:`/api/social?media=${p.id}`} : null,likes:s.likes.filter(l=>l.post===p.id&&!blocked(l.user)).length,liked:s.likes.some(l=>l.post===p.id&&l.user===uid),comments:s.comments.filter(c=>c.post===p.id&&!blocked(c.user))}));
 const mine=new Set(posts.filter(p=>p.user===uid).map(p=>p.id));
 const notifications=[...s.likes.filter(l=>mine.has(l.post)&&l.user!==uid).map(l=>({...l,type:'like'})),...s.comments.filter(c=>mine.has(c.post)&&c.user!==uid).map(c=>({...c,type:'comment'})),...s.follows.filter(f=>f.target===uid).map(f=>({...f,type:'follow'}))].filter(n=>!blocked(n.user)).sort((a,b)=>b.created-a.created).slice(0,50);
 return {me:s.profiles[uid]||{id:uid,name:'새로운 이웃',bio:'',emoji:'🙂'},profiles,posts,following:s.follows.filter(f=>f.user===uid&&!blocked(f.target)).map(f=>f.target),followers:s.follows.filter(f=>f.target===uid&&!blocked(f.user)).map(f=>f.user),blocked:s.blocks.filter(b=>b.user===uid).map(b=>({id:b.target,name:s.profiles[b.target]?.name||'사용자'})),notifications};
}
export async function update(store,uid,action){for(let i=0;i<5;i++){const old=await store.getWithMetadata('community',{type:'json'});const next=mutate(old?.data||empty(),uid,action);const result=await store.setJSON('community',next,old?{onlyIfMatch:old.etag}:{onlyIfNew:true});if(result.modified)return next;}fail('다른 요청과 겹쳤습니다. 잠시 후 다시 시도해주세요.',409);}
