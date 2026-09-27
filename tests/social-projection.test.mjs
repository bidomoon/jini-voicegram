import test from 'node:test';
import assert from 'node:assert/strict';
import {visible} from '../netlify/functions/_shared/social-core.mjs';
import {referenceVisible} from './helpers/social-reference.mjs';
import {largeCommunity} from './helpers/social-fixture.mjs';
test('indexed feed preserves counts, ordering, privacy and notification limits at beta capacity',()=>{
 const state=largeCommunity(),snapshot=structuredClone(state);
 for(const uid of ['u0','u1','u22','u81','u499','new-user'])assert.deepEqual(visible(state,uid),referenceVisible(state,uid),uid);
 assert.deepEqual(state,snapshot,'reading must not mutate saved data');
 assert.ok(visible(state,'u0').posts.every(p=>p.user==='u0'||Number(p.user.slice(1))>=50));
});
