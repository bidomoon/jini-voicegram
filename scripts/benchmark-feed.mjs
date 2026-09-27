import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {visible} from '../netlify/functions/_shared/social-core.mjs';
import {referenceVisible} from '../tests/helpers/social-reference.mjs';
import {largeCommunity} from '../tests/helpers/social-fixture.mjs';
const state=largeCommunity();assert.deepEqual(visible(state,'u0'),referenceVisible(state,'u0'));
function median(fn){for(let i=0;i<5;i++)fn(state,'u0');const times=[];for(let i=0;i<25;i++){const t=performance.now();fn(state,'u0');times.push(performance.now()-t);}return times.sort((a,b)=>a-b)[12];}
const before=median(referenceVisible),after=median(visible);
console.log(JSON.stringify({scope:'local CPU only; excludes network and storage',profiles:500,posts:300,likes:15000,comments:3000,runs:25,beforeMedianMs:before,afterMedianMs:after,reductionPercent:(1-after/before)*100},null,2));
