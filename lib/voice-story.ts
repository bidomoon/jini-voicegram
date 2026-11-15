export type VoiceAction='dictate'|'replace'|'append'|'undo'|'preview'|'publish'|'edit'|'photo'|'video'|'record'|'remove'|'read'|'save';
export function voiceCommand(raw:string):{action:VoiceAction;text?:string}{
 const text=raw.trim().replace(/[.!?。！？]+$/u,''),t=text.replace(/\s+/g,'');
 if(/^(?:확인했어|확인했어요|확인완료)[,，]?(?:게시해줘|올려줘)$/.test(t)||/^(?:게시확정|확인하고게시해줘)$/.test(t))return {action:'publish'};
 if(/^(?:이대로|이내용으로|지금)?(?:미리보기|올려줘|게시해줘|공유준비해줘|미리보여줘)$/.test(t))return {action:'preview'};
 if(/^(?:수정할게|수정할게요|게시취소|올리지마|아직올리지마|돌아가서수정)$/.test(t))return {action:'edit'};
 if(/^(?:방금말취소|방금말한것취소|되돌리기|되돌려줘)$/.test(t))return {action:'undo'};
 if(/^(?:내|오늘찍은|어제찍은)?사진(?:을)?(?:선택|선택해줘|넣어줘|추가해줘|올려줘)$/.test(t))return {action:'photo'};
 if(/^(?:내|오늘찍은|어제찍은)?(?:영상|동영상)(?:을)?(?:선택|선택해줘|넣어줘|추가해줘|올려줘)$/.test(t))return {action:'video'};
 if(/^(?:영상촬영|동영상촬영|영상찍기|영상찍을래)$/.test(t))return {action:'record'};
 if(/^(?:사진빼줘|영상빼줘|첨부빼줘)$/.test(t))return {action:'remove'};
 if(/^(?:읽어줘|글읽어줘|내용읽어줘)$/.test(t))return {action:'read'};
 if(/^(?:임시저장|임시저장해줘|저장해줘)$/.test(t))return {action:'save'};
 const replace=text.match(/^(?:내용을?|게시글을?|글을?)\s*(?:바꿔줘|수정해줘)\s*[:：]?\s+([\s\S]+)$/u)||text.match(/^(?:그대로적어줘|다시쓸게)\s*[:：]?\s+([\s\S]+)$/u);
 if(replace)return {action:'replace',text:replace[1].trim()};
 const append=text.match(/^(?:추가해줘|이어서써줘|덧붙여줘)\s*[:：]?\s+([\s\S]+)$/u);
 return {action:append?'append':'dictate',text:append?append[1].trim():raw.trim()};
}
export const appendStory=(a:string,b:string)=>[a.trim(),b.trim()].filter(Boolean).join('\n');
