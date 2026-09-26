import {getStore} from '@netlify/blobs';
export const store=()=>getStore({name:'voicegram-media-v1',consistency:'strong'});
