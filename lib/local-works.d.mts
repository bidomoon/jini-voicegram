export type LocalWork = {scope:string;id:string;title:string;kind:'image'|'video';mime:string;size:number;created:number};
export type StoredWork = LocalWork & {blob:Blob};
export interface LocalWorkStore {
  limits:{count:number;bytes:number;fileBytes:number};
  save(item:{id:string;title:string;kind:'image'|'video';blob:Blob}):Promise<LocalWork>;
  list():Promise<LocalWork[]>;
  get(id:string):Promise<StoredWork|null>;
  remove(id:string):Promise<void>;
  clear():Promise<void>;
  close():Promise<void>;
}
export function createLocalWorkStore(options?:{indexedDB?:IDBFactory|null;scope?:string}):LocalWorkStore;
