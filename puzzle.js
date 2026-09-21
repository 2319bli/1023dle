/* Three-colour circuit rules. Exact reverse BFS, including directional moves. */
(function(root){
  'use strict';
  const TARGET=1023,STATES=59049,POW=Array.from({length:10},(_,i)=>3**i);
  const COLORS=['Amber','Cyan','Violet'],SYMBOLS=['●','▲','◆'];
  const digit=(state,i)=>Math.floor(state/POW[i])%3;
  const decode=state=>POW.map((_,i)=>digit(state,i));
  const encode=colours=>colours.reduce((sum,c,i)=>sum+c*POW[i],0);
  function randomFor(seed){let h=2166136261;for(const c of seed)h=Math.imul(h^c.charCodeAt(0),16777619);return()=>{h+=0x6D2B79F5;let x=Math.imul(h^h>>>15,h|1);x^=x+Math.imul(x^x>>>7,x|61);return((x^x>>>14)>>>0)/4294967296}}
  function shuffle(a,r){for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
  function rank(rows){const a=rows.map(r=>[...r]);let n=0;for(let c=0;c<10&&n<a.length;c++){const p=a.findIndex((r,i)=>i>=n&&r[c]!==0);if(p<0)continue;[a[n],a[p]]=[a[p],a[n]];if(a[n][c]===2)a[n]=a[n].map(v=>v*2%3);for(let i=n+1;i<a.length;i++){const f=a[i][c];a[i]=a[i].map((v,j)=>(v-f*a[n][j]+6)%3)}n++}return n}
  function apply(state,op,inverse=false){
    const indices=op.indices;
    if(op.type==='cycle'||op.type==='reverse'){
      const delta=inverse?3-op.delta:op.delta;
      for(const i of indices){const old=digit(state,i);state+=(((old+delta)%3)-old)*POW[i]}return state;
    }
    if(op.type==='swap'){const [a,b]=indices,x=digit(state,a),y=digit(state,b);return state+(y-x)*POW[a]+(x-y)*POW[b]}
    if(op.type==='rotate'){
      const values=indices.map(i=>digit(state,i));
      indices.forEach((i,j)=>{const src=inverse?(j+1)%3:(j+2)%3;state+=(values[src]-values[j])*POW[i]});return state;
    }
    throw Error('Unknown operation');
  }
  function solve(operations,targetState){
    const distances=new Int16Array(STATES).fill(-1),nextSwitch=new Int8Array(STATES).fill(-1),ways=new Float64Array(STATES),queue=new Int32Array(STATES);
    let length=1;queue[0]=targetState;distances[targetState]=0;ways[targetState]=1;
    for(let head=0;head<length;head++){
      const state=queue[head];
      operations.forEach((op,index)=>{
        // A predecessor is reached with the inverse, but the hint is the forward action.
        const predecessor=apply(state,op,true);
        if(distances[predecessor]<0){distances[predecessor]=distances[state]+1;nextSwitch[predecessor]=index;queue[length++]=predecessor}
        if(distances[predecessor]===distances[state]+1)ways[predecessor]=Math.min(Number.MAX_SAFE_INTEGER,ways[predecessor]+ways[state]);
      });
    }
    return{distances,nextSwitch,ways,reachable:length};
  }
  const cache=new Map();
  function generate(seed){
    if(cache.has(seed))return cache.get(seed);
    const random=randomFor(seed),candidates=[];
    for(let a=0;a<10;a++)for(let b=a+1;b<10;b++){candidates.push([a,b]);for(let c=b+1;c<10;c++)candidates.push([a,b,c])}
    shuffle(candidates,random);const rows=[],operations=[];
    for(const indices of candidates){const row=POW.map((_,i)=>indices.includes(i)?1:0);if(rank([...rows,row])===rows.length)continue;rows.push(row);const reverse=operations.length>=6;operations.push({type:reverse?'reverse':'cycle',delta:reverse?2:1,indices});if(rows.length===10)break}
    for(let i=0;i<4;i++){const indices=shuffle(Array.from({length:10},(_,j)=>j),random).slice(0,i<2?2:3);operations.push({type:i<2?'swap':'rotate',indices})}
    // Preserve the seeded stream so existing circuits and saved moves stay valid.
    // Earlier versions consumed 10 value draws and 9 shuffle draws here.
    for(let i=0;i<19;i++)random();
    const weights=Array.from({length:10},(_,i)=>2**(9-i));
    const targetColors=shuffle([0,1,2,...Array.from({length:7},()=>Math.floor(random()*3))],random),targetState=encode(targetColors);
    const solution=solve(operations,targetState),par=4+Math.floor(random()*4),starts=[];
    for(let state=0;state<STATES;state++)if(solution.distances[state]===par&&targetColors.filter((v,i)=>v!==digit(state,i)).length>=5)starts.push(state);
    const initial=starts[Math.floor(random()*starts.length)],puzzle={operations,weights,targetState,targetColors,initial,par,...solution};
    if(initial===undefined)throw Error('No suitable starting circuit');
    cache.set(seed,puzzle);if(cache.size>8)cache.delete(cache.keys().next().value);return puzzle;
  }
  function daily(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z')))throw Error('Expected a UTC date');return{date,number:Math.floor((Date.parse(date+'T00:00:00Z')-Date.UTC(2026,8,21))/86400000)+1,...generate('1023-colour-daily-v2:'+date)}}
  function stateFrom(puzzle,path){if(!Array.isArray(path)||path.length>100000||path.some(i=>!Number.isInteger(i)||i<0||i>=puzzle.operations.length))throw Error('Invalid switch history');let state=puzzle.initial;for(const index of path){if(state===puzzle.targetState)throw Error('Moves after completion');state=apply(state,puzzle.operations[index])}return state}
  const matches=(puzzle,state)=>puzzle.targetColors.filter((v,i)=>v===digit(state,i)).length;
  const matchBits=(puzzle,state)=>puzzle.targetColors.map((v,i)=>digit(state,i)===v?'1':'0').join('');
  const signal=(puzzle,state)=>puzzle.weights.reduce((sum,v,i)=>sum+(digit(state,i)===puzzle.targetColors[i]?v:0),0);
  const api={TARGET,STATES,COLORS,SYMBOLS,digit,decode,encode,apply,solve,generate,daily,stateFrom,matches,matchBits,signal};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CircuitPuzzle=api;
})(typeof globalThis==='undefined'?this:globalThis);
