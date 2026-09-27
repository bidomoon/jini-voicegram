'use client';
import {useEffect,useRef,useState} from 'react';
import {ImagePlus,Mic,Square} from 'lucide-react';
export default function VideoPlan(p:{active:boolean;photo:string;prompt:string;duration:number;motion:string;ratio:string;ready:boolean;onPhoto:()=>void;onPrompt:(s:string)=>void;onDuration:(n:number)=>void;onMotion:(s:string)=>void;onRatio:(s:string)=>void;onCheck:()=>void}){
 const [listening,setListening]=useState(false),[notice,setNotice]=useState('');const recognition=useRef<any>(null),apply=useRef(p.onPrompt);apply.current=p.onPrompt;const enabled=useRef(p.active);enabled.current=p.active;
 useEffect(()=>{if(!p.active)recognition.current?.abort();},[p.active]);
 useEffect(()=>()=>recognition.current?.abort(),[]);
 function speak(){if(listening){recognition.current?.stop();return;}const w=window as any,SR=w.SpeechRecognition||w.webkitSpeechRecognition;if(!SR){setNotice('이 브라우저는 음성 입력을 지원하지 않아요. 아래에 적어주세요.');return;}const r=new SR();recognition.current=r;r.lang='ko-KR';r.interimResults=false;r.continuous=false;r.onstart=()=>{setListening(true);setNotice('어떻게 움직이면 좋을지 말해주세요.');};r.onend=()=>setListening(false);r.onerror=()=>{setListening(false);setNotice('마이크 권한과 연결을 확인해주세요. 글로도 입력할 수 있어요.');};r.onresult=(e:any)=>{if(!enabled.current)return;const text=Array.from(e.results as any[]).map((x:any)=>x[0].transcript).join(' ').slice(0,2000);apply.current(text);setNotice('움직임을 받아 적었어요. 생성 전에 확인해주세요.');};r.start();}
 return <section className="video-plan" aria-label="AI 동작 영상 설정">
  <div className="video-plan-heading"><span>사진이 살아 움직이도록</span><h3>어떤 동작을 할까요?</h3><p>사진 속 인물·동물·풍경의 움직임을 만들어요.</p></div>
  <button className="video-reference" onClick={p.onPhoto}>{p.photo?<img src={p.photo} alt="영상의 시작 사진"/>:<ImagePlus size={30}/>}<span><strong>{p.photo?'이 사진으로 움직임 만들기':'움직일 사진 넣기'}</strong><small>{p.photo?'사진 바꾸기':'JPG · PNG · WebP'}</small></span></button>
  <div className="motion-presets" role="group" aria-label="영상 동작">{[['natural','🌿','자연스럽게'],['perform','🎻','악기 연주'],['greet','👋','웃으며 인사'],['walk','🚶','걷기'],['custom','✨','직접 설명']].map(([v,e,t])=><button key={v} aria-pressed={p.motion===v} onClick={()=>p.onMotion(v)}><span aria-hidden="true">{e}</span>{t}</button>)}</div>
  <div className="motion-label"><label htmlFor="brief">움직임 설명</label><button className="text-button" aria-pressed={listening} onClick={speak}>{listening?<Square size={17}/>:<Mic size={17}/>} {listening?'말하기 멈추기':'말로 설명하기'}</button></div>
  <textarea id="brief" value={p.prompt} onChange={e=>p.onPrompt(e.target.value)} placeholder="예: 활을 좌우로 움직이며 비올라를 연주해줘. 머리카락과 낙엽은 바람에 살랑이게." maxLength={2000} rows={3}/>
  {notice&&<p className="muted" role="status">{notice}</p>}
  <div className="video-settings"><div><span>영상 길이</span><div role="group" aria-label="영상 길이">{[5,10].map(n=><button key={n} aria-pressed={p.duration===n} onClick={()=>p.onDuration(n)}>{n}초</button>)}</div></div><div><span>화면 방향</span><div role="group" aria-label="영상 방향">{[['9:16','세로'],['16:9','가로']].map(([v,t])=><button key={v} aria-pressed={p.ratio===v} onClick={()=>p.onRatio(v)}>{t}</button>)}</div></div></div>
  <p className="video-detail-note">인물과 악기의 동작을 생성합니다. 소리는 포함되지 않아요. 포스터 글씨나 손가락 등 세부 모습은 달라질 수 있어요.</p>
  {!p.ready&&<div className="video-connection"><strong>AI 동작 영상 연결이 필요해요</strong><p>사진과 글로 움직임을 먼저 설계할 수 있어요. 실제 영상은 운영자 연결 후 생성합니다.</p><button className="secondary" onClick={p.onCheck}>연결 상태 다시 확인</button></div>}
 </section>;
}
