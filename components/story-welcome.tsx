'use client';
import {Mic,Eye,Send,ArrowUpRight} from 'lucide-react';
import {storyActivity} from '@/lib/story-activity';
import type {Post} from '@/lib/social-types';
export default function StoryWelcome({posts,uid,onStart}:{posts:Post[];uid:string;onStart:(question:string)=>void}){
 const activity=storyActivity(posts,uid);
 return activity.total?<section className="story-habit" aria-label="나의 이야기 기록"><div><strong>{activity.today?'오늘의 이야기를 남겼어요':activity.streak?'어제의 이야기, 오늘도 이어볼까요?':'오늘의 한 줄을 남겨보세요'}</strong><p>이번 주 {activity.week}개 · 이야기를 남긴 날 {activity.days}일{activity.streak>1?' · '+activity.streak+'일 연속':''}</p></div><button className="text-button" onClick={()=>onStart('오늘 나에게 가장 기억에 남은 순간은 무엇인가요?')}>오늘 이야기<ArrowUpRight size={17}/></button></section>:<section className="first-story-guide" aria-label="첫 이야기 안내"><div><span className="guide-eyebrow">처음이라도 괜찮아요</span><h2>말 한마디로 시작하는 나의 피드</h2><p>“오늘 산책하다 예쁜 꽃을 봤어요.”<br/>짧게 말하고, 사진 한 장을 더해보세요.</p></div><ol><li><Mic size={18}/><span>눌러서 말하기</span></li><li><Eye size={18}/><span>내용 확인하기</span></li><li><Send size={18}/><span>게시 확정하기</span></li></ol><button className="text-button" onClick={()=>onStart('오늘 나를 웃게 한 작은 일은 무엇인가요?')}>첫 이야기 시작<ArrowUpRight size={17}/></button></section>;
}
