import {empty} from '../../netlify/functions/_shared/social-core.mjs';
export function largeCommunity(){
 const state=empty();
 for(let i=0;i<500;i++)state.profiles['u'+i]={id:'u'+i,name:'이웃 '+i,emoji:'🙂',bio:''};
 for(let i=0;i<300;i++)state.posts.push({id:'p'+i,user:'u'+i%80,caption:'하루 이야기 '+i,created:1700000000000+i,media:i%3?{type:'image/jpeg'}:null,deleted:i%31===0});
 for(let i=0;i<15000;i++)state.likes.push({user:'u'+Math.floor(i/300),post:'p'+i%300,created:1700001000000+i});
 for(let i=0;i<3000;i++)state.comments.push({id:'c'+i,user:'u'+i%500,post:'p'+i%300,body:'반가워요 '+i,created:1700002000000+i});
 for(let i=0;i<500;i++)state.follows.push({user:'u'+i,target:'u'+i%20,created:1700003000000+i});
 for(let i=1;i<50;i++)state.blocks.push(i%2?{user:'u0',target:'u'+i}:{user:'u'+i,target:'u0'});
 return state;
}
