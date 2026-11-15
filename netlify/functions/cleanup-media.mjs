import {getStore} from '@netlify/blobs';
import {cleanUploads} from './_shared/social-upload.mjs';
import {store} from './_shared/storage.mjs';
import {purgeClosedMedia} from './_shared/privacy.mjs';
import {accountStore} from './_shared/accounts.mjs';
import {cleanAccounts} from './_shared/account-lifecycle.mjs';
export default async function(){const community=getStore({name:'voicegram-social-beta-v1',consistency:'strong'});await purgeClosedMedia(community,{limit:30,deadline:Date.now()+8000});await cleanAccounts(accountStore(),{deadline:Date.now()+3000,limit:50});await cleanUploads(community,Date.now(),{deadline:Date.now()+10000});const s=store();const {blobs}=await s.list({prefix:'asset-info/'});for(const b of blobs){const meta=await s.get(b.key,{type:'json'});if(meta?.exp<Date.now()){await s.delete('asset/'+b.key.slice('asset-info/'.length));await s.delete(b.key);}}}
export const config={schedule:'0 * * * *'}; // Every hour at minute zero UTC (KST minute zero).
