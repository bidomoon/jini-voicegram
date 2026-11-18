import type {Design} from './artwork';

// Seniorgram's simple occasion → name → finished card flow, adapted to Voicegram.
export const greetingCards = [
 {id:'morning',label:'안부',title:'오늘도 좋은 하루',message:'따뜻한 웃음과 좋은 일이 가득한 하루 보내세요.',theme:'fresh'},
 {id:'birthday',label:'생일',title:'생일을 축하합니다',message:'건강과 행복이 늘 함께하시길 바랍니다.',theme:'pop'},
 {id:'thanks',label:'감사',title:'고맙습니다',message:'함께해 주신 마음, 오래도록 기억하겠습니다.',theme:'classic'},
 {id:'support',label:'응원',title:'당신을 응원합니다',message:'천천히 가도 괜찮아요. 오늘의 한 걸음을 응원합니다.',theme:'fresh'},
] as const;
export type GreetingOccasion = typeof greetingCards[number]['id'];
export function greetingDesign(id:GreetingOccasion,previous:Design):Design{
 const card=greetingCards.find(card=>card.id===id)!;
 return {...previous,greeting:id,recipient:previous.recipient||'',sender:previous.sender||'',headline:card.title,subtitle:card.message,theme:card.theme,ratio:'1:1',fontSize:94,showText:true};
}
type GreetingCommand={action:'card';occasion:GreetingOccasion}|{action:'field';field:'recipient'|'sender'|'headline'|'subtitle';value:string}|{action:'finish'|'share'|'export'};
export function greetingCommand(raw:string):GreetingCommand|null{
 const text=raw.trim().replace(/[.!?。！？]+$/u,''),compact=text.replace(/\s+/g,'');
 const card=compact.match(/^(아침인사|안부(?:인사)?|생일(?:축하)?|생신(?:축하)?|감사(?:인사)?|응원)(?:카드)?(?:를)?(?:만들어줘|만들어주세요|만들기)$/u);
 if(card){const occasion:GreetingOccasion=/생일|생신/.test(card[1])?'birthday':/^감사/.test(card[1])?'thanks':card[1]==='응원'?'support':'morning';return {action:'card',occasion};}
 const field=text.match(/^(받는\s*이름|받는\s*분|보내는\s*분|보내는\s*이름|제목|문구)(?:을|를|은|는)?\s+(.+?)\s*(?:바꿔\s*줘|바꿔\s*주세요|넣어\s*줘|써\s*줘)$/u);
 if(field){const key=/^받는/.test(field[1])?'recipient':/^보내는/.test(field[1])?'sender':field[1]==='제목'?'headline':'subtitle';return {action:'field',field:key,value:field[2].trim().replace(/(?:으로|로)$/u,'').trim()};}
 if(/^(?:이대로|그대로)?카드(?:를)?완성(?:해줘|해주세요|하기)?$/u.test(compact))return {action:'finish'};
 if(/^(?:카톡|카카오톡)(?:으로)?(?:보내줘|공유해줘)$/u.test(compact))return {action:'share'};
 if(/^(?:사진첩|사진앱|파일)(?:에|로)?저장(?:해줘|해주세요)$/u.test(compact))return {action:'export'};
 return null;
}
