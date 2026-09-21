const assert=require('node:assert/strict'),P=require('../puzzle.js');
const p=P.daily('2026-09-21');
assert.deepEqual(p.weights,[512,256,128,64,32,16,8,4,2,1]);
for(let mask=0;mask<1024;mask++){
 const state=P.encode(p.targetColors.map((v,i)=>mask&(1<<(9-i))?v:(v+1)%3));
 assert.equal(P.signal(p,state),mask);assert.equal(P.matchBits(p,state),mask.toString(2).padStart(10,'0'));
}
assert.equal(P.matchBits(p,p.targetState),'1111111111');
console.log('All 1,024 match masks map to the correct binary score.');
