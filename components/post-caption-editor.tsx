'use client';
import {useEffect,useRef,useState} from 'react';
import VoiceStoryControl from '@/components/voice-story-control';
import {appendStory,voiceCommand} from '@/lib/voice-story';

export default function PostCaptionEditor({caption,onSave,onCancel}:{caption:string;onSave:(value:string,expectedCaption:string)=>Promise<boolean>;onCancel:()=>void}){
 const [value,setValue]=useState(caption),[review,setReview]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>()=>window.speechSynthesis?.cancel(),[]);
 const original=useRef(caption);
 const history=useRef<string[]>([]),saving=useRef(false);
 function change(next:string){if(next.length>2200){setNotice('게시글은 2,200자까지 입력해주세요.');return;}history.current=[...history.current.slice(-19),value];setValue(next);setReview(false);setNotice('');}
 async function save(){if(saving.current)return;saving.current=true;setBusy(true);try{if(await onSave(value.trim(),original.current))setNotice('수정한 내용을 저장했어요.');else setNotice('저장하지 못했어요. 연결 상태와 안내를 확인해주세요. 다른 곳에서 수정했다면 이 창을 닫고 피드를 새로고침해주세요.');}finally{saving.current=false;setBusy(false);}}
 function read(){if(!('speechSynthesis' in window)){setNotice('이 브라우저는 글 듣기를 지원하지 않아요.');return;}window.speechSynthesis.cancel();const speech=new SpeechSynthesisUtterance(value);speech.lang='ko-KR';speech.rate=.95;window.speechSynthesis.speak(speech);}
 function command(raw:string){
  if(/^수정\s*확정[.!?。！？]*$/.test(raw.trim())){if(review)void save();else setReview(true);return;}
  const c=voiceCommand(raw);
  if(c.action==='replace')change(c.text||'');
  else if(c.action==='dictate'||c.action==='append')change(appendStory(value,c.text||''));
  else if(c.action==='undo'){const prior=history.current.pop();if(prior!==undefined){setValue(prior);setReview(false);setNotice('마지막 수정을 되돌렸어요.');}}
  else if(c.action==='read')read();
  else if(c.action==='edit')setReview(false);
  else if(c.action==='preview'||c.action==='save'||c.action==='publish')setReview(true);
  else setNotice('이곳에서는 게시글의 글만 수정할 수 있어요.');
 }
 return <div className="post-caption-editor">
  <p>사진·영상과 댓글·좋아요는 그대로 두고 글을 수정해요.</p>
  <VoiceStoryControl active={!busy} disabled={busy} review={review} editing onCommand={command} onRead={read}/>
  <label htmlFor="edit-post-caption">수정할 게시글</label>
  <textarea id="edit-post-caption" value={value} maxLength={2200} rows={5} disabled={busy} onChange={e=>change(e.target.value)}/>
  <p className="muted">{value.length.toLocaleString()}/2,200자 · {review?'확인 후 “수정 확정”이라고 말하거나 저장을 눌러주세요.':'“내용 바꿔줘 …”, “추가해줘 …”, “방금 말 취소”'}</p>
  {notice&&<p role="status">{notice}</p>}
  {review?<><button className="primary" disabled={busy||value.trim()===original.current} onClick={()=>void save()}>{busy?'저장 중…':'수정 내용 저장'}</button><button className="secondary" disabled={busy} onClick={()=>setReview(false)}>다시 수정</button></>:<button className="primary" disabled={busy||value.trim()===original.current} onClick={()=>setReview(true)}>수정 내용 확인</button>}
  <button className="text-button" disabled={busy} onClick={onCancel}>닫기</button>
 </div>;
}
