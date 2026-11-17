import {readFile,writeFile} from 'node:fs/promises';
// Synthetic, silent two-second test pattern. A valid ISO BMFF `free` box makes
// a ~7 MB fixture without shipping megabytes of unrelated footage in the repo.
const source=new URL('../public/checks/sample-video.mp4',import.meta.url);
const video=await readFile(source),padding=Buffer.alloc(7_000_000-video.length);
if(padding.length<8)throw Error('The check video must remain smaller than 7 MB.');
padding.writeUInt32BE(padding.length);padding.write('free',4,'ascii');
await writeFile(new URL('../public/checks/large-video.mp4',import.meta.url),Buffer.concat([video,padding]));
