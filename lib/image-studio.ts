export const imageSamples=[
 {id:'sea',label:'차분한 풍경',src:'/visuals/quiet-sea.webp',caption:'잠깐 쉬어가도 괜찮아. 오늘의 나에게 여유 한 조각.',prompt:'고요한 바다와 부드러운 햇살을 담은 차분한 풍경. 참고 이미지의 편안한 분위기를 살려 새로운 장면으로 만들어줘.'},
 {id:'party',label:'생일 · 축하',src:'/visuals/image-samples/party.webp',caption:'오늘의 주인공에게, 생일을 진심으로 축하해! 🎉',prompt:'밝은 파티와 축하 분위기의 이미지. 참고 이미지의 색감과 축제 분위기를 살리고 글자를 얹을 공간을 남겨줘.'},
 {id:'comic',label:'유쾌한 팝아트',src:'/visuals/image-samples/comic.webp',caption:'오늘도 내 방식대로! 기분 좋은 에너지를 나눠요. ✨',prompt:'경쾌한 팝아트 스타일. 선명한 색과 재치 있는 분위기를 살리고 중심 대상을 돋보이게 해줘.'},
 {id:'flowers',label:'꽃 · 고마운 마음',src:'/visuals/image-samples/flowers.webp',caption:'고마운 마음을 꽃처럼 가득 담아 전해요. 💐',prompt:'따뜻한 꽃과 부드러운 빛이 있는 이미지. 참고 이미지의 다정한 분위기로 새로운 구도를 만들어줘.'},
] as const;
export type ImageChoice={id:string;url:string;prompt:string;created:number};
export type ImageInstruction={action:'pick';index:number;target?:'sample'|'result';overlay?:string}|{action:'caption';index:number}|{action:'overlay';text:string}|{action:'edit';prompt:string}|{action:'samples'};
function copy(text:string){return text.trim().replace(/(?:으로|로)$/u,'').trim().replace(/^["“]|["”]$/g,'');}
/** Only complete control phrases are commands; quoted examples and ordinary posts stay literal. */
export function imageInstruction(raw:string):ImageInstruction|null{
 const numbers:Record<string,string>={일:'1',이:'2',삼:'3',사:'4',오:'5',육:'6',칠:'7',팔:'8',구:'9'};
 const text=raw.trim().replace(/[.!?。！？]+$/u,'').replace(/(^|\s)([일이삼사오육칠팔구])\s*번/u,(_,space:string,number:string)=>space+numbers[number]+'번');
 if(/^(?:이미지\s*)?샘플(?:을|들)?\s*(?:보여줘|보여주세요|열어줘)$/u.test(text))return {action:'samples'};
 const pick=text.match(/^(?:(샘플|완성(?:된)?(?:\s*(?:이미지|사진|결과))?|결과)\s*)?([1-9])\s*번\s*(?:(샘플|완성(?:된)?|결과)\s*)?(?:이미지|사진|그림|결과)?(?:가|이|를|는|로|으로)?\s*(?:좋아|좋다|좋아요|선택(?:해|해줘|해주세요)?|적용(?:해줘|해|하고|해주세요)?|써줘|사용해줘)(?:[,，]?\s*문구(?:는|를|은|을)?\s+(.+?)\s*(?:넣어줘|넣어주세요|써줘|바꿔줘))?$/u);
 if(pick){const labels=[pick[1],pick[3]].filter(Boolean).join(' '),sample=/샘플/u.test(labels),result=/완성|결과/u.test(labels);if(sample&&result)return null;return {action:'pick',index:Number(pick[2])-1,...(sample?{target:'sample' as const}:result?{target:'result' as const}:{}),...(pick[4]?{overlay:copy(pick[4])}:{})};}
 const caption=text.match(/^([1-9])\s*번\s*(?:샘플\s*)?(?:문구|캡션)(?:를|가|이|는|로|으로)?\s*(?:좋아|좋다|좋아요|선택(?:해줘)?|적용(?:해줘)?|써줘|넣어줘|사용해줘)$/u);
 if(caption)return {action:'caption',index:Number(caption[1])-1};
 const overlay=text.match(/^(?:이미지\s*)?(?:문구|제목)(?:는|를|은|을)?\s+(.+?)\s*(?:넣어줘|넣어주세요|써줘|바꿔줘|바꿔주세요)$/u);
 if(overlay&&copy(overlay[1]))return {action:'overlay',text:copy(overlay[1])};
 if(/^(?:대상|주인공|배경|색감|분위기)(?:은|는|을|를)?\s+.+(?:바꿔줘|바꿔주세요|만들어줘|만들어주세요)$/u.test(text)||/^(?:이|지금|현재|선택한)\s*(?:이미지|사진|그림)(?:와|과)?\s*(?:비슷하게|비슷한\s*느낌으로|같은\s*스타일로)\s*(?:새로\s*)?(?:그려줘|만들어줘|만들어주세요)$/u.test(text))return {action:'edit',prompt:text};
 return null;
}
/** Never silently switch between the two independently numbered image lists. */
export function imageSelectionTarget(command:Extract<ImageInstruction,{action:'pick'}>,view:{review:boolean;samplesVisible:boolean;hasResults:boolean}):'sample'|'result'|'ambiguous'{
 if(command.target)return command.target;
 if(view.hasResults&&view.samplesVisible&&!view.review)return 'ambiguous';
 return view.review&&view.hasResults?'result':'sample';
}
export function validImageChoices(input:unknown):ImageChoice[]{
 if(!Array.isArray(input))return [];
 return input.filter((x):x is ImageChoice=>!!x&&typeof x.id==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(x.id)&&typeof x.url==='string'&&x.url.length<8000000&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(x.url)&&typeof x.prompt==='string'&&x.prompt.length<=2000&&Number.isFinite(x.created)).slice(-3);
}
