import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
import {randomUUID} from 'node:crypto';
const source=transformSync(readFileSync(new URL('../lib/ios-native.ts',import.meta.url),'utf8'),{loader:'ts',format:'esm'}).code;
const native=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

test('native transcript and draft boundaries reject oversized or malformed payloads',()=>{
 const id=randomUUID(),caption='아이폰에서 남긴 이야기';
 assert.deepEqual(native.decodeIOSDraft({id,caption,extra:'ignored'}),{id,caption});
 for(const value of [null,{}, {id:'../bad',caption},{id,caption:''},{id,caption:'x'.repeat(2201)},{id,caption:123}])assert.equal(native.decodeIOSDraft(value),null);
 for(const phase of ['start','partial','final','error','end'])assert.deepEqual(native.decodeIOSSpeech({id,phase,text:caption,extra:'ignored'}),{id,phase,text:caption});
 for(const value of [{id,phase:'publish',text:caption},{id,phase:{toString:()=> 'final'},text:caption},{id,phase:'final',text:'x'.repeat(2201)},{id:'bad',phase:'final',text:caption}])assert.equal(native.decodeIOSSpeech(value),null);
});

test('ordinary browsers preserve existing download and share fallbacks',async()=>{
 const previous=globalThis.window;
 delete globalThis.window;
 try{assert.equal(native.isIOSApp(),false);assert.equal(native.postIOS('speech.start'),false);assert.equal(native.shareIOS('https://example.test/','text'),false);assert.equal(await native.saveIOSFile(new Blob(['record']),'record.json'),false);}finally{if(previous)globalThis.window=previous;}
});

test('native sharing only accepts this app origin and preserves the action allowlist',()=>{
 const previous=globalThis.window,location=globalThis.location,calls=[];
 globalThis.window={webkit:{messageHandlers:{voicegram:{postMessage:m=>calls.push(m)}}}};
 globalThis.location={href:'https://jini-voicegram.netlify.app/',origin:'https://jini-voicegram.netlify.app'};
 try{
  assert.equal(native.shareIOS('https://jini-voicegram.netlify.app/?post=123','내 이야기'),true);
  for(const url of ['http://jini-voicegram.netlify.app/','https://jini-voicegram.netlify.app.evil.test/','https://example.test/'])assert.equal(native.shareIOS(url,'text'),false);
  native.postIOS('ready',{action:'speech.start'});
  assert.equal(calls.length,2);assert.equal(calls[1].action,'ready');
 }finally{globalThis.window=previous;globalThis.location=location;}
});

test('file exports match responses by request id and cannot use traversal paths or oversized data',async()=>{
 const previous=globalThis.window,reader=globalThis.FileReader;
 const window=new EventTarget(),calls=[];
 window.webkit={messageHandlers:{voicegram:{postMessage:m=>{calls.push(m);queueMicrotask(()=>{window.dispatchEvent(new CustomEvent('voicegram-native-result',{detail:{id:randomUUID(),error:'unrelated response'}}));window.dispatchEvent(new CustomEvent('voicegram-native-result',{detail:{id:m.id,ok:true}}));});}}}};
 globalThis.window=window;
 globalThis.FileReader=class{readAsDataURL(blob){blob.arrayBuffer().then(b=>{this.result='data:application/json;base64,'+Buffer.from(b).toString('base64');this.onload();});}};
 try{
  assert.equal(await native.saveIOSFile(new Blob(['{"my":"data"}']),'voicegram-records.json'),true);
  assert.equal(calls.length,1);assert.equal(calls[0].action,'file.export');assert.equal(Buffer.from(calls[0].base64,'base64').toString(),'{"my":"data"}');
  for(const name of ['../record.json','.private','a/b.json','a\\b.json','a\n.json'])await assert.rejects(native.saveIOSFile(new Blob(['data']),name));
  await assert.rejects(native.saveIOSFile(new Blob([new Uint8Array(20_000_001)]),'video.mp4'));
  assert.equal(calls.length,1);
 }finally{globalThis.window=previous;globalThis.FileReader=reader;}
});
