'use client';
import {useEffect, useRef, useState} from 'react';
import {Film, ImageOff, RefreshCw} from 'lucide-react';

/** Videos attach only near the viewport and never play behind another screen. */
export default function SocialMedia({url, type, alt = '', priority = false, tile = false, active = true}: {url: string; type: string; alt?: string; priority?: boolean; tile?: boolean; active?: boolean}) {
 const holder = useRef<HTMLDivElement>(null), video = useRef<HTMLVideoElement>(null);
 const [near, setNear] = useState(false), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);
 const isVideo = type.startsWith('video');
 useEffect(() => {
  if (!isVideo || !holder.current) return;
  const observer = new IntersectionObserver(entries => {
   if (entries[0].isIntersecting) setNear(true);
  }, {rootMargin: '120px 0px'});
  const playbackObserver = new IntersectionObserver(entries => {
   if (!entries[0].isIntersecting) video.current?.pause();
  }, {threshold: 0.1});
  const pause = () => {if (document.hidden) video.current?.pause();};
  observer.observe(holder.current);
  playbackObserver.observe(holder.current);
  document.addEventListener('visibilitychange', pause);
  return () => {observer.disconnect(); playbackObserver.disconnect(); document.removeEventListener('visibilitychange', pause);};
 }, [isVideo]);
 useEffect(() => {if (!active) video.current?.pause();}, [active]);
 const src = retry ? `${url}${url.includes('?') ? '&' : '?'}retry=${retry}` : url;
 return <div ref={holder} className={'social-media ' + (tile ? 'media-tile' : '')}>
  {failed ? <div className="media-error"><ImageOff size={26}/><span>{isVideo ? '영상을' : '사진을'} 불러오지 못했어요</span>{!tile && <button onClick={() => {setFailed(false); setRetry(n => n + 1);}}><RefreshCw size={16}/>다시 불러오기</button>}</div> : isVideo ? <>
   {!near && <div className="media-placeholder" aria-label="영상"><Film size={30}/></div>}
   <video ref={video} className={tile ? '' : 'feed-visual'} src={near ? src : undefined} controls={!tile} muted={tile} playsInline preload={near ? 'metadata' : 'none'} aria-label={alt || '게시물 영상'} onError={() => setFailed(true)}/>
  </> : <img className={tile ? '' : 'feed-visual'} src={src} alt={alt} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async" onError={() => setFailed(true)}/>}
 </div>;
}
