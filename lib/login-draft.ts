import {readDraft,writeDraft,validDraft,hasDraftContent,type StoryDraft} from './story-draft';
const marker='vg-login-draft-v2';
type LoginDraft={scope:string;postId:string;expires:number};
type SaveRequest={waitUntil:(p:Promise<unknown>)=>void};

export async function prepareLogin(){
 const pending:Promise<unknown>[]=[];
 window.dispatchEvent(new CustomEvent<SaveRequest>('voicegram-before-login',{detail:{waitUntil:p=>pending.push(p)}}));
 await Promise.all(pending);
}
export async function preserveLoginDraft(scope:string,draft:StoryDraft){
 if(!hasDraftContent(draft))return;
 await writeDraft(scope,draft);
 // Only a pointer goes into sessionStorage; video Blobs remain intact in IndexedDB.
 const value:LoginDraft={scope,postId:draft.postId||'',expires:Date.now()+86400000};
 sessionStorage.setItem(marker,JSON.stringify(value));
}
export async function resumeLoginDraft(){
 let raw:string|null;try{raw=sessionStorage.getItem(marker);}catch{return null;}if(!raw)return null;
 let m:LoginDraft;try{m=JSON.parse(raw);}catch{sessionStorage.removeItem(marker);return null;}
 if(!m||typeof m.scope!=='string'||!Number.isFinite(m.expires)||m.expires<Date.now()){sessionStorage.removeItem(marker);return null;}
 const draft=await readDraft(m.scope);
 return validDraft(draft)&&draft.postId===m.postId&&hasDraftContent(draft)?{scope:m.scope,draft}:null;
}
export function clearLoginDraft(){try{sessionStorage.removeItem(marker);}catch{}}
export function waitForDraftSave(event:Event,promise:Promise<unknown>){
 const detail=(event as CustomEvent<SaveRequest>).detail;
 if(detail?.waitUntil)detail.waitUntil(promise);else void promise.catch(()=>{});
}
