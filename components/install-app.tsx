'use client';
import {useEffect,useRef,useState} from 'react';
import {Smartphone,ArrowUpRight} from 'lucide-react';
type InstallPrompt=Event&{prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
export default function InstallApp(){
 const [open,setOpen]=useState(false),[installed,setInstalled]=useState(false),[ready,setReady]=useState(false),[message,setMessage]=useState('');const prompt=useRef<InstallPrompt|null>(null);
 useEffect(()=>{const standalone=window.matchMedia('(display-mode: standalone)');setInstalled(standalone.matches||!!(navigator as Navigator&{standalone?:boolean}).standalone);const offer=(event:Event)=>{event.preventDefault();prompt.current=event as InstallPrompt;setReady(true);};const done=()=>{setInstalled(true);prompt.current=null;setReady(false);};window.addEventListener('beforeinstallprompt',offer);window.addEventListener('appinstalled',done);return()=>{window.removeEventListener('beforeinstallprompt',offer);window.removeEventListener('appinstalled',done);};},[]);
 async function install(){const p=prompt.current;if(!p){setOpen(v=>!v);return;}prompt.current=null;setReady(false);try{await p.prompt();const choice=await p.userChoice;if(choice.outcome==='accepted')setMessage('설치 요청을 보냈어요. 홈 화면에서 보이스그램을 찾아주세요.');else setOpen(true);}catch{setOpen(true);}}
 return <section className="install-app"><div><Smartphone size={22}/><div><strong>{installed?'홈 화면에서 바로 만나요':'내 폰에 보이스그램 담기'}</strong><p>{installed?'앱처럼 열어 오늘 이야기를 남겨보세요.':'홈 화면에서 한 번에 열고, 편하게 이야기해요.'}</p></div></div>{!installed&&<button className="text-button" onClick={()=>void install()} aria-expanded={open}>{ready?'설치하기':'홈 화면에 추가'}<ArrowUpRight size={17}/></button>}{open&&<div className="install-instructions"><p><b>아이폰</b> Safari에서 공유 메뉴 → ‘홈 화면에 추가’ → ‘추가’를 눌러주세요. ‘웹 앱으로 열기’가 보이면 켜주세요.</p><p><b>안드로이드·컴퓨터</b> Chrome 메뉴에서 ‘설치’ 또는 ‘홈 화면에 추가’를 찾아주세요. 카카오톡 안이라면 기본 브라우저로 먼저 열어주세요.</p><small>설치 후에도 인터넷 연결과 참여 권한이 필요해요.</small></div>}{message&&<p role="status">{message}</p>}</section>;
}
