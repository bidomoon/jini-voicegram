'use client';
import {useState} from 'react';
import {greetingCards,greetingGroups} from '@/lib/greeting-cards';
export type GreetingCard = (typeof greetingCards)[number];
export default function GreetingCardPicker({onChoose,disabled}:{onChoose:(card:GreetingCard)=>void;disabled:boolean}){
 const [group,setGroup]=useState('모두'),[pending,setPending]=useState<GreetingCard|null>(null);
 return <details className="greeting-card-picker"><summary>인사 · 축하 카드 30종</summary><p className="muted">예시를 고르고 글을 바꿔보세요. 준비된 카드에는 유료 AI가 필요하지 않아요.</p><div className="greeting-groups" role="group" aria-label="카드 종류">{greetingGroups.map(name=><button type="button" key={name} disabled={disabled} aria-pressed={group===name} onClick={()=>setGroup(name)}>{name}</button>)}</div><div className="greeting-grid">{greetingCards.filter(card=>group==='모두'||card.group===group).map(card=><button type="button" key={card.id} disabled={disabled} onClick={()=>setPending(card)}><strong>{card.label}</strong><span>{card.title}</span></button>)}</div><div aria-live="polite">{pending&&<section className="greeting-confirm"><strong>{pending.label} 카드로 바꿀까요?</strong><p>현재 입력한 글과 카드 제목이 선택한 문구로 바뀌어요. 사진은 유지됩니다.</p><button type="button" className="secondary" disabled={disabled} onClick={()=>{onChoose(pending);setPending(null);}}>이 카드 문구 사용</button><button type="button" className="text-button" onClick={()=>setPending(null)}>그대로 두기</button></section>}</div><p className="muted">카드를 고르면 지금 입력한 글과 카드 제목이 바뀝니다. 사진은 유지돼요.</p></details>;
}
