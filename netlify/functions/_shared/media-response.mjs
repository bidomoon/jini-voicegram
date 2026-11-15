// Safari video playback and seeking use byte-range requests. Authorization stays at the caller.
export function mediaResponse(bytes,type,range){
 const data=new Uint8Array(bytes),size=data.byteLength;
 const headers=new Headers({'Content-Type':type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes'});
 if(!range){headers.set('Content-Length',String(size));return new Response(data,{headers});}
 const match=/^bytes=(\d*)-(\d*)$/.exec(range);
 const invalid=()=>{headers.set('Content-Range','bytes */'+size);return new Response(null,{status:416,headers});};
 if(!match||!size||(!match[1]&&!match[2]))return invalid();
 let start,end;
 if(!match[1]){const suffix=Number(match[2]);if(!Number.isSafeInteger(suffix)||suffix<=0)return invalid();start=Math.max(0,size-suffix);end=size-1;}
 else{start=Number(match[1]);end=match[2]?Number(match[2]):size-1;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||end<start)return invalid();end=Math.min(end,size-1);}
 headers.set('Content-Range',`bytes ${start}-${end}/${size}`);headers.set('Content-Length',String(end-start+1));
 return new Response(data.slice(start,end+1),{status:206,headers});
}
