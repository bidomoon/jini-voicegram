import {getStore} from '@netlify/blobs';
import {cleanUploads} from './_shared/social-upload.mjs';
import {store} from './_shared/storage.mjs';
import {purgeClosedMedia} from './_shared/privacy.mjs';
import {accountStore} from './_shared/accounts.mjs';
import {cleanAccounts} from './_shared/account-lifecycle.mjs';
export default async function(){
 const deadline=Date.now()+23000,budget=ms=>Math.min(deadline,Date.now()+ms),community=getStore({name:'voicegram-social-beta-v1',consistency:'strong'}),checks=getStore({name:'voicegram-selftest-v1',consistency:'strong'});
 await purgeClosedMedia(community,{limit:20,deadline:budget(5000)});await purgeClosedMedia(checks,{limit:10,deadline:budget(3000)});await cleanAccounts(accountStore(),{deadline:budget(3000),limit:50});await cleanUploads(community,Date.now(),{deadline:budget(5000)});await cleanUploads(checks,Date.now(),{deadline:budget(4000)});
 const s=store();const {blobs}=await s.list({prefix:'asset-info/'});for(const b of blobs){if(Date.now()>deadline)return;const meta=await s.get(b.key,{type:'json'});if(meta?.exp<Date.now()){await s.delete('asset/'+b.key.slice('asset-info/'.length));await s.delete(b.key);}}
}
export const config={schedule:'0 * * * *'}; // Every hour at minute zero UTC (KST minute zero).
