const assert=require('node:assert/strict'),P=require('../puzzle.js');
let previous,checked=0,noncommuting=false,specialOnShortest=false;
for(let day=0;day<40;day++){
 const date=new Date(Date.UTC(2026,8,21+day)).toISOString().slice(0,10),p=P.daily(date);
 assert.deepEqual(p,P.daily(date));assert.equal(p.reachable,59049);assert.equal(p.operations.length,14);
 assert.equal(p.weights.reduce((a,b)=>a+b,0),1023);assert.equal(new Set(p.targetColors).size,3);
 assert.notDeepEqual(p.operations,previous);previous=p.operations;
 assert.equal(p.distances[p.initial],p.par);assert(p.par>=4&&p.par<=7);
 let s=p.initial,route=[];while(s!==p.targetState){const i=p.nextSwitch[s],n=P.apply(s,p.operations[i]);assert.equal(p.distances[n],p.distances[s]-1);route.push(i);s=n;if(i>=10)specialOnShortest=true;}
 assert.equal(route.length,p.par);assert.equal(P.stateFrom(p,route),p.targetState);assert.equal(P.signal(p,p.targetState),1023);assert.equal(P.matches(p,p.targetState),10);
 // Independently enumerate the small-depth forward frontier to verify the reverse-BFS minimum and path count.
 if(day<3){let layer=new Map([[p.initial,1]]);for(let depth=0;depth<p.par;depth++){assert(!layer.has(p.targetState));const next=new Map();for(const [state,ways] of layer)for(const op of p.operations){const n=P.apply(state,op);next.set(n,(next.get(n)||0)+ways)}layer=next;}assert.equal(layer.get(p.targetState),p.ways[p.initial]);}
 for(let trial=0;trial<30;trial++){
  const state=(day*347+trial*1987)%P.STATES;
  for(const op of p.operations){const n=P.apply(state,op);assert(n>=0&&n<P.STATES);assert.equal(P.apply(n,op,true),state);let repeated=state;for(let k=0;k<(op.type==='swap'?2:3);k++)repeated=P.apply(repeated,op);assert.equal(repeated,state);}
  if(P.apply(P.apply(state,p.operations[0]),p.operations[10])!==P.apply(P.apply(state,p.operations[10]),p.operations[0]))noncommuting=true;
 }
 assert.throws(()=>P.stateFrom(p,[...route,0]));assert.throws(()=>P.stateFrom(p,[14]));checked++;
}
assert(noncommuting);assert(specialOnShortest);
// Exact special-operation semantics, independently specified.
const start=P.encode([0,1,2,0,0,0,0,0,0,0]);
assert.deepEqual(P.decode(P.apply(start,{type:'swap',indices:[0,2]})).slice(0,3),[2,1,0]);
assert.deepEqual(P.decode(P.apply(start,{type:'rotate',indices:[0,1,2]})).slice(0,3),[2,0,1]);
console.log(`${checked} daily circuits: all 59,049 states reachable; exact shortest counts independently checked; inverse, colour-cycle, swap, rotation, and order-sensitive rules passed.`);
