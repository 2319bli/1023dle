const vm = require('node:vm'), fs = require('node:fs'), assert = require('node:assert/strict');
const P = require('../puzzle.js');
const PROFILE = { id: 'test-player', nickname: 'Tester', token: 'a'.repeat(64) };
function app(storage = new Map()) {
  const nodes = new Map(), calls = [], events = new Map();
  const element = () => ({ textContent: '', innerHTML: '', hidden: true, disabled: false, open: false, tagName: 'BUTTON', classList: { toggle(){}, remove(){} }, setAttribute(k,v){this[k]=v}, focus(){}, select(){}, append(){}, replaceChildren(){}, showModal(){this.open=true}, close(){this.open=false} });
  const get = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
  let offline = false, delayed = null, gate = null;
  storage.set('1023-player-v1', JSON.stringify(PROFILE));
  const ctx = { CircuitPuzzle: P, console, crypto: require('node:crypto').webcrypto, Intl, Date, AbortController, setInterval(){}, setTimeout, clearTimeout,
    location: { hostname: 'localhost', origin: 'http://localhost:4173', pathname: '/' }, navigator: {},
    localStorage: { getItem:k=>storage.get(k)||null, setItem:(k,v)=>storage.set(k,v) },
    window: { addEventListener:(n,f)=>events.set(n,f) },
    document: { getElementById:get, createElement:element, querySelectorAll:()=>[], addEventListener:(n,f)=>events.set(n,f) },
    async fetch(url, options) {
      const body = options.body ? JSON.parse(options.body) : null; calls.push({url,body});
      if (gate) await gate;
      if (offline) throw Error('Offline');
      let data;
      if (url.endsWith('/runs')) data = { id:'12345678-1234-1234-1234-123456789012', round:0, seed:'ranked-zero', cleared:0, ended:false };
      else if (url.endsWith('/round')) data = { id:'12345678-1234-1234-1234-123456789012', round:body.round+1, seed:'ranked-'+(body.round+1), cleared:body.round+1, ended:false };
      else if (url.endsWith('/daily')) data = {moves:body.path.length};
      else data = { entries:[], totalPlayers:0, me:null };
      return {ok:true,json:async()=>data};
    }
  };
  vm.createContext(ctx);
  for (const file of ['game.js','leaderboard.js']) vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
  return { nodes, calls, storage, events, run:s=>vm.runInContext(s,ctx), offline:value=>offline=value,
    hold(){gate=new Promise(resolve=>delayed=resolve)}, release(){gate=null;delayed()}, async settle(){await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve))} };
}
(async()=>{
  const a=app();a.run("setMode('endless')");await a.nodes.get('start-ranked').onclick();assert(a.run('!!rankedRun'));
  a.run('flip(0)');const seed=a.run('seed');a.run("setMode('practice');setMode('endless')");assert.equal(a.run('seed'),seed);assert.equal(a.run('path.length'),1);
  // Recreate a fresh issued round and hold its submission while changing mode.
  a.run('resetState();save()');a.hold();a.run('while(!stopped())flip(puzzle.nextSwitch[state])');
  assert(a.nodes.get('continue').disabled);a.run("setMode('practice')");a.release();await a.settle();
  assert.equal(a.run('mode'),'practice');const saved=JSON.parse(a.storage.get('1023-endless-colour-v2'));assert.equal(saved.rankedRun.next.round,1);
  a.run("setMode('endless')");assert(a.nodes.get('score-status').textContent.includes('+1'));
  const before=a.calls.filter(c=>c.url.endsWith('/round')).length;
  const reload=app(a.storage);await reload.settle();assert.equal(reload.calls.filter(c=>c.url.endsWith('/round')).length,0);
  await reload.run('nextPuzzle()');assert.equal(reload.run('rankedRun.round'),1);assert.equal(reload.run('path.length'),0);assert.equal(reload.run('cleared'),1);
  // A failed network request keeps the solved board and can be retried after reload.
  reload.offline(true);reload.run('while(!stopped())flip(puzzle.nextSwitch[state])');await reload.settle();
  assert.equal(reload.nodes.get('retry-ranked').hidden,false);assert.equal(reload.run('rankedRun.next'),undefined);
  const retry=app(reload.storage);await retry.settle();assert.equal(retry.run('rankedRun.next.round'),2);
  assert.equal(retry.run('path.length'),retry.run('puzzle.par'));assert.equal(retry.calls.filter(c=>c.url.endsWith('/round')).length,1);
  // Daily posting and modal keyboard isolation.
  retry.run("setMode('daily');while(!complete)flip(puzzle.nextSwitch[state])");await retry.nodes.get('submit-daily').onclick();await retry.settle();
  assert(retry.nodes.get('score-status').textContent.includes('On the Daily leaderboard'));
  retry.run("setMode('practice')");retry.nodes.get('open-leaderboards').onclick();const old=retry.run('path.length');
  retry.events.get('keydown')({key:'1',target:{tagName:'BUTTON'},preventDefault(){}});assert.equal(retry.run('path.length'),old);
  assert.equal(before,1);
  console.log('Passed: ranked mode switching, receipts saved during background requests, reload idempotency, offline retry, round continuation, Daily submission, dialog keyboard isolation.');
})().catch(error=>{console.error(error);process.exitCode=1});
