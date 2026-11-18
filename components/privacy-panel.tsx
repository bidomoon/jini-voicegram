'use client';
import {saveIOSFile} from '@/lib/ios-native';
import {useEffect,useRef,useState} from 'react';
import {Download,ShieldCheck} from 'lucide-react';

type DeletionResult={mediaCleanupPending:boolean;accountCleanupPending:boolean};
export default function PrivacyPanel({authenticated,onLogin,onClosed}:{authenticated:boolean;onLogin:()=>void;onClosed:(result:DeletionResult)=>void}){
 const [busy,setBusy]=useState(false),[confirm,setConfirm]=useState(''),[deleting,setDeleting]=useState(false),[error,setError]=useState('');
 const [readiness,setReadiness]=useState<'loading'|'ready'|'unavailable'|'error'>('loading'),[statusMessage,setStatusMessage]=useState('');
 const pending=useRef(false),statusVersion=useRef(0),statusAbort=useRef<AbortController|null>(null),deletionId=useRef('');
 async function checkDeletion(){
  const version=++statusVersion.current;statusAbort.current?.abort();
  const controller=new AbortController();statusAbort.current=controller;const timeout=setTimeout(()=>controller.abort(),10000);
  setReadiness('loading');setStatusMessage('');
  try{
   const r=await fetch('/api/privacy?status=1',{signal:controller.signal});
   const d=await r.json() as {canDelete?:boolean;message?:string;error?:string};
   if(!r.ok)throw Error(d.error||'계정 삭제 연결을 확인하지 못했어요. 다시 확인해주세요.');
   if(version!==statusVersion.current)return;
   setReadiness(d.canDelete===true?'ready':'unavailable');setStatusMessage(d.message||'현재 계정 삭제 연결을 사용할 수 없어요. 다시 확인해주세요.');
  }catch(e){if(version===statusVersion.current){setReadiness('error');setStatusMessage(e instanceof Error&&e.name!=='AbortError'?e.message:'계정 삭제 연결 응답이 없어요. 네트워크를 확인하고 다시 시도해주세요.');}}
  finally{clearTimeout(timeout);}
 }
 useEffect(()=>{if(authenticated)void checkDeletion();return()=>{statusVersion.current++;statusAbort.current?.abort();};},[authenticated]);
 async function download(){if(pending.current)return;pending.current=true;setBusy(true);setError('');try{const r=await fetch('/api/privacy');if(!r.ok){const d=await r.json() as {error?:string};throw Error(d.error||'내 기록을 가져오지 못했어요.');}const file=await r.blob();if(await saveIOSFile(file,'voicegram-my-records-'+new Date().toISOString().slice(0,10)+'.json'))return;const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download='voicegram-my-records-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}catch(e){setError(e instanceof Error?e.message:'연결을 확인해주세요.');}finally{pending.current=false;setBusy(false);}}
 async function close(){
  if(pending.current||confirm!=='내 계정 삭제'||readiness!=='ready')return;
  pending.current=true;setBusy(true);setError('');deletionId.current||=crypto.randomUUID();
  try{
   const r=await fetch('/api/privacy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'closeAccount',confirm,requestId:deletionId.current})});
   const d=await r.json() as {error?:string;closed?:boolean;mediaCleanupPending?:boolean;accountCleanupPending?:boolean};
   if(!r.ok||d.closed!==true)throw Error(d.error||'삭제 결과를 확인하지 못했어요. 완료된 것으로 표시하지 않았어요.');
   onClosed({mediaCleanupPending:!!d.mediaCleanupPending,accountCleanupPending:!!d.accountCleanupPending});
  }catch(e){setError(e instanceof Error?e.message:'삭제 결과를 확인하지 못했어요. 연결을 확인해주세요.');}
  finally{pending.current=false;setBusy(false);}
 }
 return <section className="privacy-panel"><h3><ShieldCheck size={19}/> 내 기록은 내가 관리해요</h3><p>내 프로필, 작성글과 활동 기록을 내려받을 수 있어요. 사진·영상은 로그인 후 열 수 있는 링크로 포함됩니다.</p>
 {!authenticated?<button className="secondary" onClick={onLogin}>로그인하고 내 기록 관리</button>:<>
 <button className="secondary" onClick={download} disabled={busy}><Download size={17}/>{busy&&!deleting?'내려받는 중…':'내 글·활동 기록 내려받기'}</button>
 {!deleting?<button className="text-button danger" onClick={()=>setDeleting(true)} disabled={busy}>계정과 게시물 삭제</button>:<div className="account-delete-review">
 <strong>내 계정과 이야기를 삭제할까요?</strong><p>프로필·게시글·댓글·좋아요·팔로우와 차단·신고 기록을 삭제하고 로그인 연결을 종료해요. 삭제 후 복구할 수 없어요.</p>
 <p>게시물에 첨부한 사진·영상 원본도 삭제합니다. 원본 정리가 지연되면 계정 삭제 결과와 구분해 알려드려요. 필요한 원본은 먼저 따로 저장해주세요.</p>
 <p>이 브라우저의 임시 작성글, 아이폰의 음성 초안, 내려받은 파일과 다른 앱에 공유한 사본은 남을 수 있어요. 해당 기기·앱에서 직접 지워주세요.</p>
 {readiness==='loading'&&<p role="status">계정 삭제 연결을 확인하고 있어요.</p>}
 {['unavailable','error'].includes(readiness)&&<div className="deletion-connection"><p role="alert">{statusMessage}</p><button type="button" className="secondary" onClick={()=>void checkDeletion()} disabled={busy}>삭제 연결 다시 확인</button></div>}
 <label htmlFor="delete-account-phrase">계속하려면 ‘내 계정 삭제’를 입력해주세요.</label><input id="delete-account-phrase" value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="off" maxLength={20} disabled={busy}/>
 <div className="privacy-actions"><button className="secondary" disabled={busy} onClick={()=>{setDeleting(false);setConfirm('');setError('');deletionId.current='';}}>돌아가기</button><button className="primary danger-fill" disabled={busy||readiness!=='ready'||confirm!=='내 계정 삭제'} onClick={close}>{busy?'삭제 결과 확인 중…':'확인하고 계정 삭제'}</button></div>
 </div>}</>}
 {error&&<p role="alert">{error}</p>}</section>;
}
