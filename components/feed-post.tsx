'use client';
import {useEffect, useRef, useState} from 'react';
import {Bookmark, Heart, MessageCircle, MoreHorizontal, Send, Square, Volume2} from 'lucide-react';
import type {Post, Profile} from '@/lib/social-types';
import SocialMedia from './social-media';
type Props = {post: Post; author: Profile; me: string; following: boolean; saved: boolean; busy: boolean; speaking: boolean; priority?: boolean; detail?: boolean; active?: boolean; ago: string; commentAuthor?: string; onProfile: () => void; onFollow: () => void; onMenu: () => void; onLike: (value: boolean) => void; onComments: () => void; onShare: () => void; onSave: () => void; onRead: () => void; onCreate: () => void};
export default function FeedPost({post: p, author, me, following, saved, busy, speaking, priority, detail, active, ago, commentAuthor, onProfile, onFollow, onMenu, onLike, onComments, onShare, onSave, onRead, onCreate}: Props) {
 const [expanded, setExpanded] = useState(false), [pulse, setPulse] = useState(false);
 const lastTap = useRef({time: 0, x: 0, y: 0}), lastLike = useRef(0);
 const long = p.caption.length > 150 || p.caption.split('\n').length > 3;
 useEffect(() => {if (pulse) {const t = setTimeout(() => setPulse(false), 700); return () => clearTimeout(t);}}, [pulse]);
 function doubleLike() {
  if (p.sample || busy || Date.now() - lastLike.current < 350) return;
  lastLike.current = Date.now(); setPulse(true); if (!p.liked) onLike(true);
 }
 const caption = <div className={'post-body ' + (!p.media ? 'text-post' : '')}>
  <p className={long && !expanded && !detail ? 'caption-collapsed' : ''}>{p.media && <strong className="caption-author">{author.name} </strong>}{p.caption}</p>
  {long && !detail && <button className="caption-toggle" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>{expanded ? '접기' : '더 보기'}</button>}
 </div>;
 return <article className={'feed-card ' + (p.sample ? 'sample-card' : '')} id={detail ? undefined : 'post-' + p.id} data-post-id={p.id}>
  <header className="post-top"><button className="person-button" onClick={onProfile}><span className="social-avatar">{author.emoji}</span><span><strong>{author.name}</strong><small>{p.sample ? '화면 체험용 예시' : ago}{p.ai ? ' · AI로 만든 콘텐츠' : ''}</small></span></button>
   {!p.sample && p.user !== me && <button className="follow-mini" disabled={busy} onClick={onFollow}>{following ? '팔로잉' : '팔로우'}</button>}
   {!p.sample && <button className="icon-button" aria-label="게시물 메뉴" onClick={onMenu}><MoreHorizontal size={22}/></button>}
  </header>
  {p.media ? <div className="post-media" onDoubleClick={p.media.type.startsWith('image') ? doubleLike : undefined} onPointerUp={e => {
   if (e.pointerType !== 'touch' || !p.media?.type.startsWith('image')) return;
   const prev = lastTap.current, now = Date.now();
   if (now - prev.time < 280 && Math.hypot(prev.x - e.clientX, prev.y - e.clientY) < 24) {doubleLike(); lastTap.current.time = 0;}
   else lastTap.current = {time: now, x: e.clientX, y: e.clientY};
  }} onPointerCancel={() => {lastTap.current.time = 0;}}>
   <SocialMedia url={p.media.url} type={p.media.type} alt={author.name + '님의 게시물'} priority={priority} active={active}/>
   {pulse && <span className="double-heart" aria-hidden="true"><Heart fill="currentColor" size={88}/></span>}
  </div> : caption}
  <div className={'post-actions ' + (p.sample ? 'sample-actions' : '')}>
   <button aria-label={p.sample ? '예시 게시물 좋아요' : p.liked ? '좋아요 취소' : '좋아요'} aria-pressed={p.liked} className={p.liked ? 'liked' : ''} disabled={p.sample || busy} onClick={() => onLike(!p.liked)}><Heart size={25} fill={p.liked ? 'currentColor' : 'none'}/><span>{p.likes || ''}</span></button>
   <button aria-label={p.sample ? '예시 게시물 댓글' : '댓글 열기'} disabled={p.sample} onClick={onComments}><MessageCircle size={25}/><span>{p.comments.length || ''}</span></button>
   <button aria-label="게시물 공유" disabled={p.sample} onClick={onShare}><Send size={23}/></button>
   <button className="save-post" aria-label={saved ? '저장 취소' : '게시물 저장'} aria-pressed={saved} disabled={p.sample} onClick={onSave}><Bookmark size={24} fill={saved ? 'currentColor' : 'none'}/></button>
  </div>
  {p.media && caption}
  {p.comments.length > 0 && <button className="comment-peek" onClick={onComments}><strong>{commentAuthor}</strong> {p.comments[p.comments.length - 1].body}<span>댓글 {p.comments.length}개 모두 보기</span></button>}
  <div className="post-foot"><button onClick={onRead} aria-label={speaking ? '읽기 중지' : '게시글 읽어주기'} aria-pressed={speaking}>{speaking ? <Square size={15}/> : <Volume2 size={16}/>}<span>{speaking ? '읽기 중지' : '글 듣기'}</span></button>{p.sample ? <span>예시 게시물 · 실제 사용자 글이 아니에요</span> : <time dateTime={new Date(p.created).toISOString()}>{ago}</time>}</div>
  {p.sample && <div className="sample-footer"><button onClick={onCreate}>내 이야기 올리기</button></div>}
 </article>;
}
