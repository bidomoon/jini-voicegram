import {generationStore} from './_shared/generation.mjs';
/** Only expired temporary generation results; never social posts or local drafts. */
export async function cleanupGenerationResults(store,now=Date.now(),limit=500){let checked=0,removed=0;const started=Date.now();for await(const page of store.list({prefix:'requests/',paginate:true})){for(const item of page.blobs){if(checked>=limit||Date.now()-started>20000)return {checked,removed,limited:true};const record=await store.getMetadata(item.key);checked++;if(Number.isFinite(record?.metadata?.expires)&&record.metadata.expires<now){await store.delete(item.key);removed++;}}}return {checked,removed,limited:false};}
export default async()=>{const counts=await cleanupGenerationResults(generationStore());console.log('Temporary generation result cleanup',counts);};
export const config={schedule:'0 4 * * *'};
