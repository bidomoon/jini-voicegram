// Existing project owner, verified through Netlify on 2026-11-15.
// These are public account/site identifiers, never authentication credentials.
// A copied/remixed site does not inherit this grant: both trusted context fields must match.
export const ownerPolicy={siteId:'e78fcfa6-0dd7-45e0-a3e1-e417ce52b91c',ownerId:'682c9c09944158b640143e5f'};
export function operatorIdentity(context,read=()=>undefined){
 const configured=read('VOICEGRAM_MODERATOR_NETLIFY_IDS');
 const allowed=(typeof configured==='string'?configured:context?.site?.id===ownerPolicy.siteId?ownerPolicy.ownerId:'').split(',').map(s=>s.trim()).filter(Boolean);
 return typeof context?.user?.id==='string'&&allowed.includes(context.user.id)?'netlify:'+context.user.id:null;
}
