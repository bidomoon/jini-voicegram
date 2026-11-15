const fail=(s,status=400)=>{throw Object.assign(Error(s),{status});};
export function moderationView(s,now=Date.now()){
 const active=s.posts.filter(p=>!p.deleted),week=now-7*86400000;
 return {metrics:{profiles:Object.keys(s.profiles).length,posts:active.filter(p=>!p.moderated).length,weeklyAuthors:new Set(active.filter(p=>p.created>=week).map(p=>p.user)).size,pendingReports:s.reports.filter(r=>r.status==='received').length,hiddenPosts:active.filter(p=>p.moderated).length},
 reports:s.reports.slice().sort((a,b)=>b.created-a.created).slice(0,100).map(r=>{const p=s.posts.find(p=>p.id===r.post);return {...r,caption:p?.caption||'삭제된 게시물',author:p?s.profiles[p.user]?.name||'탈퇴한 사용자':'',hidden:!!p?.moderated,deleted:!p||!!p.deleted};})};
}
export function moderate(s,actor,a,now=Date.now()){
 const report=s.reports.find(r=>r.id===a.id);if(!report)fail('신고를 찾을 수 없습니다.',404);
 const note=typeof a.note==='string'?a.note.trim().slice(0,500):'';
 if(!note)fail('처리 근거를 입력해주세요.');
 if(!['hide','restore','dismiss'].includes(a.action))fail('처리 방법을 확인해주세요.');
 const p=s.posts.find(p=>p.id===report.post);
 if(a.action!=='dismiss'&&(!p||p.deleted))fail('삭제된 게시물은 변경할 수 없습니다.',409);
 if(a.action==='hide')p.moderated=true;
 if(a.action==='restore')p.moderated=false;
 report.status=a.action==='hide'?'hidden':a.action==='restore'?'restored':'dismissed';report.resolved=now;
 s.moderationAudit=[...(s.moderationAudit||[]),{id:report.id,post:report.post,actor,action:a.action,note,created:now}].slice(-500);
 return s;
}
