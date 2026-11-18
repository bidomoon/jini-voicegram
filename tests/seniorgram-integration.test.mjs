import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from 'esbuild';
const load=async name=>import('data:text/javascript;base64,'+Buffer.from(transformSync(readFileSync(new URL('../lib/'+name,import.meta.url),'utf8'),{loader:'ts',format:'esm'}).code).toString('base64'));
const {greetingCards,greetingCommand,greetingDesign}=await load('greeting-card.ts');
const {createMediaActions}=await load('media-actions.ts');
const design={headline:'기존 제목',subtitle:'기존 문구',brand:'',theme:'classic',ratio:'4:5',fontSize:104,photo:'data:image/png;base64,existing',showText:false};
const blob=new Blob(['test PNG bytes'],{type:'image/png'});

test('explicit greeting requests open local cards, while stories and quotations remain stories',()=>{
 for(const [text,id] of [['아침 인사 만들어줘','morning'],['안부 카드 만들어주세요','morning'],['생신 카드 만들어줘','birthday'],['감사 카드 만들기','thanks'],['응원카드를 만들어줘','support']])assert.deepEqual(greetingCommand(text),{action:'card',occasion:id});
 for(const text of ['오늘 아침 인사 만들어줘라는 말을 들었어요','할머니 생일에 응원 카드를 만들었어요','응원','“카톡으로 보내줘”','게시 확정'])assert.equal(greetingCommand(text),null);
 assert.deepEqual(greetingCommand('받는 이름을 서준으로 바꿔줘'),{action:'field',field:'recipient',value:'서준'});
 assert.deepEqual(greetingCommand('보내는 분을 할머니로 바꿔줘'),{action:'field',field:'sender',value:'할머니'});
 assert.deepEqual(greetingCommand('제목을 행복한 하루로 바꿔줘'),{action:'field',field:'headline',value:'행복한 하루'});
 assert.equal(greetingCommand('이대로 카드 완성해줘').action,'finish');
 assert.equal(greetingCommand('카톡으로 보내줘').action,'share');
});
test('all four local cards keep the selected photo and have ready-to-render square text without mutating the source',()=>{
 for(const card of greetingCards){const next=greetingDesign(card.id,design);assert.equal(next.photo,design.photo);assert.equal(next.ratio,'1:1');assert.equal(next.showText,true);assert.ok(next.headline&&next.subtitle);assert.equal(next.greeting,card.id);}
 assert.equal(design.headline,'기존 제목');assert.equal(design.showText,false);
});
test('share selection is not delivery; pending share blocks another export and releases after cancellation',async()=>{
 let finish,calls=0,downloads=0;
 const actions=createMediaActions({window:{},navigator:{canShare:()=>true,share:()=>{calls++;return new Promise((resolve,reject)=>{finish={resolve,reject};});}},download:()=>downloads++});
 const first=actions('share',blob,'card.png');
 assert.equal((await actions('save',blob,'card.png')).state,'busy');assert.equal(calls,1);assert.equal(downloads,0);
 finish.reject(new DOMException('cancel','AbortError'));assert.equal((await first).state,'cancelled');
 const second=actions('share',blob,'card.png');finish.resolve();const outcome=await second;assert.equal(outcome.state,'selected');assert.match(outcome.message,/실제 전송 결과/);assert.equal(calls,2);
});
test('save is complete only after close succeeds; failed writing is aborted and remains retryable',async()=>{
 let close,aborted=0;
 const actions=createMediaActions({navigator:{},window:{showSaveFilePicker:async()=>({createWritable:async()=>({write:async()=>{},close:()=>new Promise((resolve,reject)=>{close={resolve,reject};}),abort:async()=>aborted++})})},download:()=>assert.fail('unexpected download')});
 const first=actions('save',blob,'card.png');await new Promise(resolve=>setImmediate(resolve));
 assert.equal((await actions('share',blob,'card.png')).state,'busy');close.reject(Error('disk full'));assert.equal((await first).state,'failed');assert.equal(aborted,1);
 const retry=actions('save',blob,'card.png');await new Promise(resolve=>setImmediate(resolve));close.resolve();assert.equal((await retry).state,'saved');
});
test('unsupported share and cancelled picker keep the file; fallback download reports only a request',async()=>{
 let downloads=0;
 const actions=createMediaActions({navigator:{},window:{},download:()=>downloads++});
 assert.equal((await actions('share',blob,'card.png')).state,'unsupported');assert.equal(downloads,0);
 const fallback=await actions('save',blob,'card.png');assert.equal(fallback.state,'requested');assert.match(fallback.message,/요청/);assert.equal(downloads,1);
 const cancel=createMediaActions({navigator:{},window:{showSaveFilePicker:async()=>{throw new DOMException('cancel','AbortError');}},download:()=>assert.fail('unexpected download')});
 assert.equal((await cancel('save',blob,'card.png')).state,'cancelled');assert.equal((await actions('save',new Blob([]),'card.png')).state,'invalid');
});
