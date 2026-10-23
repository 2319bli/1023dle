const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
let uuid=0;
function app(storage=new Map(),iso='2026-09-21T23:59:58Z',blocked=false){
 const nodes=new Map(),tools=new Map(),events=new Map();let tick;
 const element=()=>({textContent:'',innerHTML:'',hidden:true,open:false,disabled:false,tagName:'BUTTON',setAttribute(k,v){this[k]=v},classList:{toggle(){},remove(){}},focus(){},select(){},showModal(){this.open=true},close(){this.open=false}});
 const switches=Array.from({length:14},element),lightNodes=Array.from({length:10},element);
 class Clock extends Date{constructor(...args){super(...(args.length?args:[iso]))}static now(){return new Date(iso).getTime()}}
 const ctx={crypto:{randomUUID(){return `test-seed-${uuid++}`}},Date:Clock,Intl,AbortController,console,setInterval(f){tick=f},CircuitPuzzle:require('../puzzle.js'),location:{origin:'https://example.test',pathname:'/'},navigator:{clipboard:{writeText:async()=>{throw Error('Unavailable')}}},localStorage:{getItem(k){if(blocked)throw Error('Blocked');return storage.get(k)||null},setItem(k,v){if(blocked)throw Error('Blocked');storage.set(k,v)}},document:{getElementById(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)},querySelectorAll(sel){return sel==='.switch'?switches:lightNodes},addEventListener(name,fn){events.set(name,fn)},modelContext:{registerTool(t){tools.set(t.name,t)}}},window:{addEventListener(name,fn){events.set(name,fn)}}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('game.js','utf8'),ctx);
 return {nodes,tools,ctx,run:code=>vm.runInContext(code,ctx),storage,advance(date){iso=date;tick()}};
}
(async()=>{
 const a=app();a.run('flip(0)');assert.equal(a.run('read().moves'),1);assert.throws(()=>a.run('flip(22)'));assert.equal(a.run('read().moves'),1);
 const resumed=app(a.storage);assert.equal(resumed.run('state'),a.run('state'));assert.equal(resumed.run('path.length'),1);
 assert.equal(resumed.nodes.get('hint').hidden,true);assert.equal(resumed.run('showHint()'),false);assert.equal(resumed.run('hinted'),false);
 resumed.run('while(!complete)flip(puzzle.nextSwitch[state])');assert.equal(resumed.run('read().signal'),1023);assert.equal(resumed.nodes.get('success').hidden,false);
 const reloaded=app(a.storage);assert(reloaded.run('complete'));const moves=reloaded.run('path.length');reloaded.run('flip(0)');assert.equal(reloaded.run('path.length'),moves);
 await reloaded.nodes.get('share').onclick();assert.equal(reloaded.nodes.get('share-fallback').hidden,false);
 reloaded.advance('2026-09-22T00:00:01Z');assert.equal(reloaded.nodes.get('new-day').hidden,false);assert.equal(reloaded.run('puzzle.date'),'2026-09-21');reloaded.nodes.get('new-day').onclick();assert.equal(reloaded.run('puzzle.date'),'2026-09-22');assert.equal(reloaded.run('path.length'),0);
 const denied=app(new Map(),undefined,true);assert.equal(denied.run('saving'),false);denied.run('flip(0)');assert.equal(denied.run('path.length'),1);denied.run("setMode('practice');setMode('daily')");assert.equal(denied.run('path.length'),1);
 const corrupt=new Map([['1023-daily-colour-v2:2026-09-21',JSON.stringify({date:'2026-09-21',path:[null]})]]);const recovered=app(corrupt);assert.equal(recovered.run('path.length'),0);
 const game=app();game.run('flip(2)');const dailyState=game.run('state');
 game.run("setMode('practice')");assert.equal(game.nodes.get('hint').hidden,false);assert(game.run('showHint()'));assert(game.run('hinted'));game.run('flip(1)');const practiceSeed=game.run('seed'),practiceState=game.run('state');
 game.run("setMode('daily')");assert.equal(game.run('state'),dailyState);assert.equal(game.run('showHint()'),false);assert.equal(game.run('hinted'),false);
 game.run("setMode('practice')");assert.equal(game.run('seed'),practiceSeed);assert.equal(game.run('state'),practiceState);assert(game.run('hinted'));
 game.run('nextPuzzle()');assert.notEqual(game.run('seed'),practiceSeed);assert.equal(game.run('path.length'),0);assert.equal(game.run('hinted'),false);
 game.run('while(!complete)flip(puzzle.nextSwitch[state])');assert(game.run('complete'));game.run('nextPuzzle()');assert(!game.run('complete'));
 game.run("setMode('endless')");assert.equal(game.run('showHint()'),false);assert.equal(game.nodes.get('hint').hidden,true);assert.throws(()=>game.run('nextPuzzle()'));
 // Solving on exactly perfect + 2 must advance, never lose at the boundary.
 game.run('flip(10);flip(10);while(!stopped())flip(puzzle.nextSwitch[state])');assert(game.run('complete'));assert.equal(game.run('failed'),false);assert.equal(game.run('path.length'),game.run('puzzle.par+2'));assert.equal(game.run('cleared'),1);
 const completedReload=app(game.storage);assert.equal(completedReload.run('mode'),'endless');assert.equal(completedReload.run('cleared'),1);assert(completedReload.run('complete'));
 const oldSeed=completedReload.run('seed');completedReload.run('nextPuzzle()');assert.notEqual(completedReload.run('seed'),oldSeed);assert.equal(completedReload.run('cleared'),1);assert.equal(completedReload.run('path.length'),0);
 completedReload.run('flip(0)');const runSeed=completedReload.run('seed');completedReload.run("setMode('daily');setMode('endless')");assert.equal(completedReload.run('seed'),runSeed);assert.equal(completedReload.run('path.length'),1);
 // Repeatedly toggling the same switch cannot solve a circuit with minimum >= 4.
 completedReload.run('while(!stopped())flip(10)');assert(completedReload.run('failed'));assert(!completedReload.run('complete'));assert.equal(completedReload.run('path.length'),completedReload.run('puzzle.par+2'));assert.equal(completedReload.run('cleared'),1);
 const failureMoves=completedReload.run('path.length');completedReload.run('flip(1)');assert.equal(completedReload.run('path.length'),failureMoves);
 const failedReload=app(game.storage);assert(failedReload.run('failed'));assert.equal(failedReload.run('cleared'),1);assert(failedReload.run('resultText().includes("Run over")'));
 failedReload.run('nextPuzzle()');assert.equal(failedReload.run('cleared'),0);assert.equal(failedReload.run('failed'),false);assert.equal(failedReload.run('read().round'),1);
 failedReload.run('while(!stopped())flip(puzzle.nextSwitch[state])');assert(failedReload.run('complete'));assert.equal(failedReload.run('path.length'),failedReload.run('puzzle.par'));
 assert.throws(()=>game.run("setMode('invalid')"));
 // The cosmetic banner uses wall-clock UTC, independent of puzzle date or mode.
 const holiday=app(new Map(),'2026-10-22T23:59:59.999Z');
 assert.equal(holiday.nodes.get('ten-twenty-three').hidden,true);
 const before=holiday.run('JSON.stringify(read())'),saveBefore=JSON.stringify([...holiday.storage]);
 holiday.advance('2026-10-23T00:00:00.000Z');
 assert.equal(holiday.nodes.get('ten-twenty-three').hidden,false);
 assert.equal(holiday.run('JSON.stringify(read())'),before);
 assert.equal(JSON.stringify([...holiday.storage]),saveBefore);
 holiday.nodes.get('new-day').onclick();assert.equal(holiday.run('puzzle.number'),33);
 holiday.run('flip(0)');const holidayState=holiday.run('state');
 const holidayReload=app(holiday.storage,'2026-10-23T12:00:00Z');
 assert.equal(holidayReload.run('state'),holidayState);
 assert.equal(holidayReload.nodes.get('ten-twenty-three').hidden,false);
 holidayReload.run('while(!complete)flip(puzzle.nextSwitch[state])');
 const shareBefore=holidayReload.run('resultText()');
 holidayReload.advance('2026-10-23T23:59:59.999Z');assert.equal(holidayReload.nodes.get('ten-twenty-three').hidden,false);
 holidayReload.advance('2026-10-24T00:00:00.000Z');assert.equal(holidayReload.nodes.get('ten-twenty-three').hidden,true);
 assert.equal(holidayReload.run('resultText()'),shareBefore);
 for(const name of ['practice','endless']){
  holiday.run(`setMode('${name}')`);assert.equal(holiday.nodes.get('ten-twenty-three').hidden,false);
  holiday.advance('2026-10-24T00:00:00Z');assert.equal(holiday.nodes.get('ten-twenty-three').hidden,true);
  holiday.advance('2026-10-23T12:00:00Z');assert.equal(holiday.nodes.get('ten-twenty-three').hidden,false);
 }
 for(const iso of ['2025-10-23T12:00:00Z','2027-10-23T12:00:00Z','2026-10-23T00:30:00+01:00','2026-10-22T20:00:00-04:00']){
  holiday.advance(iso);assert.equal(holiday.nodes.get('ten-twenty-three').hidden,new Date(iso).toISOString().slice(0,10)!=='2026-10-23');
 }
 console.log('Passed: 10/23 UTC boundaries, timezone offsets, year guard, open-tab rollover in all modes, unchanged state/storage/share text and holiday save reload.');
 console.log('Passed: isolated mode saves, Daily hint blocking, Practice hints and random puzzles, Endless perfect / perfect+2 success, limit failure, run continuation and restart, reloads, UTC rollover, clipboard fallback, blocked/corrupt storage.');
})().catch(e=>{console.error(e);process.exitCode=1});
