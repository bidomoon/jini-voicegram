import type {Post} from './social-types';
const DAY=86400000,localDay=(t:number)=>Math.floor((t+9*3600000)/DAY);
export function storyActivity(posts:Pick<Post,'user'|'created'|'sample'>[],uid:string,now=Date.now()){
 const own=posts.filter(p=>p.user===uid&&!p.sample&&p.created<=now),today=localDay(now),days=new Set(own.map(p=>localDay(p.created)));
 let streak=0,cursor=days.has(today)?today:today-1;while(days.has(cursor)){streak++;cursor--;}
 return {total:own.length,week:own.filter(p=>today-localDay(p.created)<7).length,days:days.size,streak,today:days.has(today)};
}
