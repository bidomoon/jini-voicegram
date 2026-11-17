// Safari video playback and seeking use byte-range requests. Authorization stays at the caller.
export function mediaResponse(bytes,type,range){
 const data=new Uint8Array(bytes),size=data.byteLength;
 const headers=new Headers({'Content-Type':type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'});
 // Stream bounded pieces so large videos also work within the host's limits.
 const body=(start,end)=>{let offset=start;return new ReadableStream({pull(controller){if(offset>end){controller.close();return;}const next=Math.min(offset+262144,end+1);controller.enqueue(data.subarray(offset,next));offset=next;},cancel(){offset=end+1;}});};
 if(!range){headers.set('Content-Length',String(size));return new Response(body(0,size-1),{headers});}
 const match=/^bytes=(\d*)-(\d*)$/.exec(range);
 const invalid=()=>{headers.set('Content-Range','bytes */'+size);return new Response(null,{status:416,headers});};
 if(!match||!size||(!match[1]&&!match[2]))return invalid();
 let start,end;
 if(!match[1]){const suffix=Number(match[2]);if(!Number.isSafeInteger(suffix)||suffix<=0)return invalid();start=Math.max(0,size-suffix);end=size-1;}
 else{start=Number(match[1]);end=match[2]?Number(match[2]):size-1;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||end<start)return invalid();end=Math.min(end,size-1);}
 headers.set('Content-Range',`bytes ${start}-${end}/${size}`);headers.set('Content-Length',String(end-start+1));
 return new Response(body(start,end),{status:206,headers});
}
