/** Pre-optimization behavior, retained as a differential test oracle. */
export function referenceVisible(s,uid){
 const blocked=id=>s.blocks.some(b=>(b.user===uid&&b.target===id)||(b.user===id&&b.target===uid));
 const profiles=Object.values(s.profiles).filter(p=>!blocked(p.id));
 const posts=s.posts.filter(p=>!p.deleted&&!blocked(p.user)).sort((a,b)=>b.created-a.created).map(p=>({...p,media:p.media?{type:p.media.type,url:`/api/social?media=${p.id}`} : null,likes:s.likes.filter(l=>l.post===p.id&&!blocked(l.user)).length,liked:s.likes.some(l=>l.post===p.id&&l.user===uid),comments:s.comments.filter(c=>c.post===p.id&&!blocked(c.user))}));
 const mine=new Set(posts.filter(p=>p.user===uid).map(p=>p.id));
 const notifications=[...s.likes.filter(l=>mine.has(l.post)&&l.user!==uid).map(l=>({...l,type:'like'})),...s.comments.filter(c=>mine.has(c.post)&&c.user!==uid).map(c=>({...c,type:'comment'})),...s.follows.filter(f=>f.target===uid).map(f=>({...f,type:'follow'}))].filter(n=>!blocked(n.user)).sort((a,b)=>b.created-a.created).slice(0,50);
 return {me:s.profiles[uid]||{id:uid,name:'새로운 이웃',bio:'',emoji:'🙂'},profiles,posts,following:s.follows.filter(f=>f.user===uid&&!blocked(f.target)).map(f=>f.target),followers:s.follows.filter(f=>f.target===uid&&!blocked(f.user)).map(f=>f.user),blocked:s.blocks.filter(b=>b.user===uid).map(b=>({id:b.target,name:s.profiles[b.target]?.name||'사용자'})),notifications};
}
