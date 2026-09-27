import type {Design} from './artwork';
export type PendingGeneration={id:string;state:'pending'|'unknown'|'failed';prompt:string;kind:string};
export type MotionPlan={id:string;videoRequestId:string;scene:string;summary:string;prompt:string;warnings:string[];duration:number;ratio:string;motion:string};
export type VideoJob={id:string;token:string;status:string;progress:number;duration?:number};
export type StoryDraft={version:1;updated:number;design:Design;caption:string;brief:string;kind:string;source:string;aiMade:boolean;step:number;literalText:boolean;referencePhoto?:boolean;artStyle?:string;previousPhoto?:string;postId?:string;file:Blob|null;job:VideoJob|null;request:PendingGeneration|null;motionPlan?:MotionPlan|null;videoMode?:string;videoDuration?:number;videoMotion?:string;videoRatio?:string};
const database='voicegram-drafts-v1',storeName='drafts';
async function db():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const r=indexedDB.open(database,1);r.onupgradeneeded=()=>r.result.createObjectStore(storeName);r.onsuccess=()=>{r.result.onversionchange=()=>r.result.close();resolve(r.result);};r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('다른 탭에서 저장소를 사용하고 있어요.'));});}
async function transaction<T>(mode:IDBTransactionMode,operation:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{const d=await db();try{return await new Promise((resolve,reject)=>{const tx=d.transaction(storeName,mode);const request=operation(tx.objectStore(storeName));let value:T;request.onsuccess=()=>{value=request.result;};tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('임시 저장이 중단됐어요.'));});}finally{d.close();}}
export function readDraft(scope:string){return transaction<StoryDraft|undefined>('readonly',s=>s.get(scope));}
export function writeDraft(scope:string,draft:StoryDraft){return transaction('readwrite',s=>s.put(draft,scope));}
export function clearDraft(scope:string){return transaction('readwrite',s=>s.delete(scope));}
export function validDraft(d:StoryDraft|undefined):d is StoryDraft{return !!d&&d.version===1&&!!d.design&&['classic','fresh','pop'].includes(d.design.theme)&&['1:1','4:5','9:16'].includes(d.design.ratio)&&typeof d.caption==='string'&&typeof d.design.photo==='string'&&['text','image','video'].includes(d.kind);}
export function hasDraftContent(d:Pick<StoryDraft,'caption'|'brief'|'design'|'file'|'request'>){return !!(d.caption.trim()||d.brief.trim()||d.design.photo||d.design.headline.trim()||d.file||d.request);}
