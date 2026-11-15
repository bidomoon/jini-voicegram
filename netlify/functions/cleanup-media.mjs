import {getStore} from '@netlify/blobs';
import {cleanUploads} from './_shared/social-upload.mjs';
import {store} from './_shared/storage.mjs';
export default async function(){await cleanUploads(getStore({name:'voicegram-social-beta-v1',consistency:'strong'}));const s=store();const {blobs}=await s.list({prefix:'asset-info/'});for(const b of blobs){const meta=await s.get(b.key,{type:'json'});if(meta?.exp<Date.now()){await s.delete('asset/'+b.key.slice('asset-info/'.length));await s.delete(b.key);}}}
export const config={schedule:'@hourly'};
