/** Recognize explicit media requests, without treating ordinary diary text as a command. */
export function creationIntent(text:string):'image'|'video'|null {
 const t=text.trim();
 if(/(그리|그려|만들|생성|제작).{0,8}(말아|마세요|말고|마\b|하지\s*마)|그리지|만들지|생성하지/.test(t))return null;
 const draw=/(그려\s*(줘|주세|줄래|줄\s*수|봐|주세요)|그려$|그리기$|draw\b|generate\s+(an?\s+)?image)/i.test(t);
 const make=/(만들어\s*(줘|주세|줄래|봐)|생성\s*(해|해줘|해주세)|제작\s*(해|해줘)|만들어$)/.test(t);
 const video=/(영상|동영상|비디오|움직이는|애니메이션)/.test(t);
 if(video&&(draw||make))return 'video';
 if(draw||make&&/(이미지|사진|그림|일러스트|캐릭터|포스터|풍경|장면)/.test(t))return 'image';
 return null;
}
