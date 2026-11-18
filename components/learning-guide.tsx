'use client';
import {useEffect,useState} from 'react';
const lessons=[
 {id:'card',title:'인사 카드 만들기',steps:['아래의 ‘카드로 연습하기’를 누르세요.','만들기 화면에서 ‘인사 · 축하 카드 30종’을 열고 마음에 드는 카드를 고르세요.','제목과 문구를 바꾸고 ‘미리보기’를 눌러 확인하세요.'],note:'준비된 카드로 연습할 때는 유료 AI가 필요하지 않아요.'},
 {id:'voice',title:'말로 입력하기',steps:['만들기 화면에서 ‘말로 만들기’를 고르세요.','마이크 사용을 허용하고 전하고 싶은 내용을 천천히 말하세요.','받아 적은 내용을 확인하세요. 잘못 적힌 글자는 직접 고칠 수 있어요.'],note:'음성 입력을 지원하지 않거나 권한을 거절한 기기에서는 ‘글로 쓰기’를 이용하세요.'},
 {id:'share',title:'보관하고 공유하기',steps:['미리보기에서 ‘완성 작품 보관하기’를 눌러 이 기기에 남기세요.','설정의 ‘이 기기 작품 보관함’에서 작품을 다시 열어보세요.','파일로 저장하거나 공유창에서 카카오톡과 받을 사람을 직접 고르세요.'],note:'피드 게시와 파일 공유는 별개예요. 공유창이 없으면 파일로 저장한 뒤 카카오톡에 직접 첨부하세요.'},
];
const key='voicegram-lessons-v1';
export default function LearningGuide({onPractice}:{onPractice:()=>void}){
 const [current,setCurrent]=useState(0),[done,setDone]=useState<string[]>([]),[ready,setReady]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>{try{const saved=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(saved))setDone(lessons.filter(l=>saved.includes(l.id)).map(l=>l.id));}catch{}setReady(true);},[]);
 function toggle(){const next=done.includes(lesson.id)?done.filter(id=>id!==lesson.id):[...done,lesson.id];setDone(next);try{localStorage.setItem(key,JSON.stringify(next));setNotice('이 기기에 연습 진도를 저장했어요.');}catch{setNotice('진도를 저장하지 못했어요. 안내는 계속 볼 수 있어요.');}}
 const lesson=lessons[current];
 return <div className="learning-guide"><p>직접 연습한 뒤 완료를 눌러주세요. {done.length} / {lessons.length}개 완료</p><div className="greeting-groups" role="group" aria-label="배울 내용">{lessons.map((l,i)=><button key={l.id} aria-pressed={current===i} onClick={()=>setCurrent(i)}>{i+1}. {l.title}{done.includes(l.id)?' · 완료':''}</button>)}</div><h3>{lesson.title}</h3><ol>{lesson.steps.map(step=><li key={step}>{step}</li>)}</ol><p>{lesson.note}</p><button className="primary" onClick={onPractice}>카드로 연습하기</button><button className="secondary" disabled={!ready} onClick={toggle}>{done.includes(lesson.id)?'완료 취소':'연습했어요 · 완료'}</button><p className="muted">진도는 이 브라우저에만 남아요. 다른 기기와 동기화되지 않아요.</p>{notice&&<p role="status">{notice}</p>}</div>;
}
