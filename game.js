'use strict';
const $=id=>document.getElementById(id), P=CircuitPuzzle;
const dateNow=()=>new Date().toISOString().slice(0,10);
const memory=new Map(), modes=['daily','practice','endless'];
const KEYS='1234567890qwer',OP_NAMES={cycle:'Cycle',reverse:'Reverse',swap:'Swap',rotate:'Rotate'},OP_ICONS={cycle:'↻',reverse:'↺',swap:'⇄',rotate:'⟳'};
const letter=i=>String.fromCharCode(65+i);
function operationText(op){const lamps=op.indices.map(letter).join(op.type==='rotate'?' → ':' · ');return `${OP_NAMES[op.type]} ${lamps}`;}
let mode='daily',puzzle,state,path=[],hinted=false,hintCount=0,complete=false,failed=false,saving=true,seed='',cleared=0,rankedRun=null;
const key=()=>mode==='daily'?'1023-daily-colour-v2:'+puzzle.date:'1023-'+mode+'-colour-v2';
const stopped=()=>complete||failed;
function stored(k){try{return localStorage.getItem(k)||memory.get(k)||null}catch{return memory.get(k)||null}}
function write(k,value){memory.set(k,value);try{localStorage.setItem(k,value);return true}catch{return false}}
function newSeed(){return typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)}
function resetState(){state=puzzle.initial;path=[];hinted=false;hintCount=0;complete=false;failed=false}
function restore(){
  resetState();
  try{
    const saved=JSON.parse(stored(key())||'null');
    if(!saved||(mode==='daily'&&saved.date!==puzzle.date))return;
    const nextState=P.stateFrom(puzzle,saved.path);
    if(mode==='endless'&&saved.path.length>puzzle.par+2)throw Error('Invalid endless history');
    state=nextState;path=saved.path;hinted=saved.hinted===true;hintCount=Number.isSafeInteger(saved.hintCount)&&saved.hintCount>=0?saved.hintCount:0;
  }catch{resetState()}
  complete=state===puzzle.targetState;failed=mode==='endless'&&!complete&&path.length>=puzzle.par+2;
}
function save(){
  saving=write(key(),JSON.stringify({date:puzzle.date,seed,path,hinted,hintCount,cleared,rankedRun}));
  $('save-status').textContent=saving?'Each mode saves on this device':'Progress saved for this visit only';
}
function read(){
  return {mode,date:puzzle.date||null,puzzle:mode==='daily'?puzzle.number:null,weights:puzzle.weights,operations:puzzle.operations.map((op,i)=>({index:i,key:KEYS[i],type:op.type,lamps:op.indices.map(letter)})),colors:P.decode(state).map(i=>P.COLORS[i]),targetColors:puzzle.targetColors.map(i=>P.COLORS[i]),matched:P.matches(puzzle,state),matchBits:P.matchBits(puzzle,state),signal:P.signal(puzzle,state),target:P.TARGET,moves:path.length,assisted:hinted,solved:complete,failed,...(mode==='endless'?{circuitsCleared:cleared,round:complete?cleared:cleared+1,moveLimit:puzzle.par+2,movesRemaining:Math.max(0,puzzle.par+2-path.length)}:{}),...(stopped()?{minimumMoves:puzzle.par,shortestSequences:puzzle.ways[puzzle.initial]}:{})};
}
function trace(index){
  document.querySelectorAll('.light').forEach((el,i)=>el.classList.toggle('traced',index>=0&&puzzle.operations[index].indices.includes(i)));
  const op=puzzle.operations[index];
  $('action-preview').textContent=op?`${KEYS[index].toUpperCase()} · ${operationText(op)}. ${op.type==='cycle'?'Amber → Cyan → Violet → Amber.':op.type==='reverse'?'Amber → Violet → Cyan → Amber.':op.type==='swap'?'Exchange these two lamps’ current colours.':'Move each colour to the next lamp; the last wraps to the first.'}`:'Hover or focus a switch to see which lamps it changes.';
}
function render(showResult=false){
  $('lights').innerHTML=puzzle.weights.map((value,i)=>{const color=P.digit(state,i),goal=puzzle.targetColors[i],on=color===goal;return `<div class="light color-light ${on?'on':''}" data-color="${color}" aria-label="Lamp ${letter(i)}, value ${value}, current ${P.COLORS[color]}, target ${P.COLORS[goal]}${on?', matched':''}"><span class="lamp-id">${letter(i)}</span><span class="bulb" aria-hidden="true">${P.SYMBOLS[color]}</span><span class="color-name">${P.COLORS[color]}</span><span class="value">${value}</span><span class="target-chip" data-color="${goal}">GOAL <b>${P.SYMBOLS[goal]}</b></span><small>${on?'1 · MATCH':'0 · MISMATCH'}</small></div>`}).join('');
  const online=P.matches(puzzle,state);
  $('signal').textContent=String(P.signal(puzzle,state)).padStart(4,'0');$('bitstring').textContent=P.matchBits(puzzle,state)+'₂';
  $('bitstring').setAttribute('aria-label','Binary match status, lamps A to J: '+P.matchBits(puzzle,state).split('').join(' '));
  $('online').innerHTML=`${online} <span>/ 10</span>`;$('meter').innerHTML=Array.from({length:10},(_,i)=>`<i class="${i<online?'on':''}"></i>`).join('');
  $('moves').textContent=String(path.length).padStart(2,'0');$('show-result').hidden=!stopped();$('show-result').textContent=mode==='daily'?'Today’s result ↗':failed?'Run result ↗':'Circuit result ↗';
  $('hint').hidden=mode!=='practice';$('hint').disabled=stopped();$('random-puzzle').hidden=mode!=='practice';
  $('endless-budget').hidden=mode!=='endless';$('budget-par').textContent=puzzle.par;$('budget-limit').textContent=puzzle.par+2;$('budget-left').textContent=`${Math.max(0,puzzle.par+2-path.length)} moves left`;
  if(mode==='endless'){$('level').textContent=String(complete?cleared:cleared+1).padStart(2,'0');$('daily-date').textContent=`${cleared} circuit${cleared===1?'':'s'} cleared`}
  document.querySelectorAll('.switch').forEach(el=>{el.classList.remove('hint');el.disabled=stopped()});
  if(stopped()){
    $('result-kicker').textContent=failed?'ENDLESS RUN OVER':mode==='daily'?'DAILY CIRCUIT COMPLETE':mode==='practice'?'PRACTICE COMPLETE':'CIRCUIT CLEARED';
    $('result-heading').textContent=failed?'The circuit got you.':path.length===puzzle.par&&!hinted?'A perfect connection.':'Circuit complete.';
    $('result').textContent=failed?`You used all ${puzzle.par+2} moves. A fresh run is waiting.`:mode==='daily'?`1023 #${puzzle.number} · ${puzzle.date}${hinted?' · Previously hint assisted':''}`:mode==='practice'?`Practice circuit${hinted?' · Hint assisted':''}`:`${cleared} circuit${cleared===1?'':'s'} cleared. Keep the run going.`;
    $('result-moves').textContent=failed?cleared:path.length;$('result-label').textContent=failed?'CIRCUITS CLEARED':'YOUR MOVES';$('result-par').textContent=puzzle.par;$('par-label').textContent=failed?'LAST MINIMUM':'MINIMUM';
    $('optimal-orders').textContent=failed?`The last circuit allowed ${puzzle.par+2} moves: ${puzzle.par} perfect + 2.`:`${puzzle.ways[puzzle.initial].toLocaleString()} shortest move sequences solve this circuit in ${puzzle.par} moves.`;
    $('continue').hidden=mode==='daily';$('continue').textContent=failed?'Start new run ↗':mode==='practice'?'Next puzzle ↗':'Next circuit ↗';
    $('share').textContent=mode==='daily'?'Copy result ↗':'Copy result';
    $('result-return').textContent=mode==='daily'?'Another circuit tomorrow · 00:00 UTC':mode==='practice'?'Take your time. Hints are here to help.':failed?'Every new run starts at circuit 1.':'Next circuit, same rule: perfect + 2. No hints.';
    if(showResult){$('success').hidden=false;(mode==='daily'?$('share'):$('continue')).focus()}
  }
  window.Leaderboards?.refresh();
}
function flip(index){
  if(!Number.isInteger(index)||index<0||index>=puzzle.operations.length)throw new Error('Switch index must be an integer from 0 to 13.');
  if(stopped())return read();
  path.push(index);state=P.apply(state,puzzle.operations[index]);complete=state===puzzle.targetState;
  // A solve on the final allowed move is a win. Otherwise, the run ends here.
  failed=mode==='endless'&&!complete&&path.length>=puzzle.par+2;
  if(mode==='endless'&&complete)cleared++;
  save();render(stopped());
  $('status').textContent=failed?'Run over. You reached the move limit.':complete?mode==='daily'?'Today’s circuit solved. Try Practice or Endless.':'Circuit solved. Ready for the next?':`Switch ${KEYS[index].toUpperCase()} activated. ${P.matches(puzzle,state)} of 10 colours matched.`;
  return read();
}
function buildBoard(){
  $('success').hidden=true;$('share-fallback').hidden=true;$('share-status').textContent='';
  $('switches').innerHTML=puzzle.operations.map((op,i)=>`<button class="switch operation-${op.type}" data-index="${i}" aria-label="Switch ${KEYS[i].toUpperCase()}: ${operationText(op)}"><span class="switch-key">${KEYS[i].toUpperCase()}</span><strong>${OP_ICONS[op.type]}</strong><span class="operation-name">${OP_NAMES[op.type]}</span><span class="connections">${op.indices.map(letter).join(op.type==='rotate'?'→':' · ')}</span></button>`).join('');
  document.querySelectorAll('.switch').forEach((el,i)=>{el.onclick=()=>{flip(i);trace(i)};el.onmouseenter=el.onfocus=()=>trace(i);el.onmouseleave=el.onblur=()=>trace(-1)});
  modes.forEach(name=>$('mode-'+name).setAttribute('aria-pressed',String(name===mode)));
  $('badge-label').textContent=mode==='endless'?'CIRCUIT':mode.toUpperCase();
  $('mode-eyebrow').textContent=mode==='daily'?'THE DAILY CIRCUIT':mode==='practice'?'A LITTLE PRACTICE':'HOW FAR CAN YOU GO?';
  $('mode-description').textContent=mode==='daily'?'Match every target colour. One daily circuit. No hints.':mode==='practice'?'Explore colour, timing, and combinations. Hints available.':'Keep connecting. Stay within two moves of perfect.';
  $('mode-note').textContent=mode==='daily'?'Each lamp is one bit: match = 1, mismatch = 0. From 512 down to 1, all ten matched make 1111111111₂ = 1023.':mode==='practice'?'Use Hint for a nudge, or New puzzle for a fresh challenge. Practice never changes your Daily result.':'Solve each circuit in the minimum + 2 moves or fewer. Reach the limit without solving and your run ends.';
  $('level').textContent=mode==='daily'?'#'+String(puzzle.number).padStart(3,'0'):mode==='practice'?'∞':String(cleared+1).padStart(2,'0');
  $('daily-date').textContent=mode==='daily'?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(puzzle.date+'T00:00:00Z')):mode==='practice'?'Unlimited random circuits':`${cleared} circuits cleared`;
  render(stopped());trace(-1);clock();
  $('status').textContent=failed?'Run over. Start again when you’re ready.':complete?'Circuit solved. Your result is saved.':path.length?'Your circuit is saved. Pick up where you left off.':'Hover or focus a switch to trace its connections.';
}
function setMode(next){
  if(!modes.includes(next))throw new Error('Choose daily, practice, or endless.');
  if(puzzle)save();mode=next;cleared=0;rankedRun=null;
  if(mode==='daily'){puzzle=P.daily(dateNow());seed=''}
  else{
    let saved;try{saved=JSON.parse(stored('1023-'+mode+'-colour-v2')||'null')}catch{}
    seed=typeof saved?.seed==='string'&&saved.seed.length>0&&saved.seed.length<200?saved.seed:newSeed();
    cleared=mode==='endless'&&Number.isSafeInteger(saved?.cleared)&&saved.cleared>=0?saved.cleared:0;
    if(mode==='endless'&&saved?.rankedRun?.seed===seed&&typeof saved.rankedRun.id==='string'&&Number.isSafeInteger(saved.rankedRun.round))rankedRun=saved.rankedRun;
    puzzle=P.generate('1023-'+mode+'-colour-v2:'+seed);
  }
  restore();save();write('1023-selected-mode-colour-v2',mode);buildBoard();return read();
}
function startDay(){return setMode('daily')}
function nextPuzzle(){
  if(mode==='daily')throw new Error('The daily puzzle only changes at midnight UTC.');
  if(mode==='endless'&&!stopped())throw new Error('Finish the current circuit before advancing.');
  if(mode==='endless'&&rankedRun)return window.Leaderboards.advance();
  if(failed)cleared=0;
  seed=newSeed();puzzle=P.generate('1023-'+mode+'-colour-v2:'+seed);resetState();save();buildBoard();return read();
}
function clock(){
  $('new-day').hidden=true;
  if(mode!=='daily'){$('daily-timer').textContent=mode==='practice'?'Hints available · No move limit':'No hints · Perfect + 2';return}
  const next=Date.parse(puzzle.date+'T00:00:00Z')+86400000,remaining=Math.max(0,Math.ceil((next-Date.now())/1000));
  $('new-day').hidden=remaining>0;
  $('daily-timer').textContent=remaining?`Next circuit in ${String(Math.floor(remaining/3600)).padStart(2,'0')}:${String(Math.floor(remaining/60)%60).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')} · UTC`:'A new daily circuit is ready';
}
function resultText(){
  if(!stopped())return '';
  const label=mode==='daily'?`#${puzzle.number} · ${puzzle.date}`:mode==='practice'?'Practice':'Endless';
  const detail=failed?`${cleared} circuit${cleared===1?'':'s'} cleared · Run over`:`${path.length} moves · minimum ${puzzle.par}${hinted?' · assisted':''}${mode==='endless'?`\n${cleared} circuits cleared · Run in progress`:''}`;
  return `1023 ${label}\n${detail}\n${complete?'🟠🔷🟣 10/10 matched':'Perfect + 2 challenge'}\n${location.origin}${location.pathname}`;
}
function showHint(){
  if(mode!=='practice'||stopped())return false;
  hinted=true;hintCount++;save();const index=puzzle.nextSwitch[state];
  document.querySelectorAll('.switch').forEach((el,i)=>el.classList.toggle('hint',i===index));trace(index);
  $('status').textContent=`Try switch ${KEYS[index].toUpperCase()}. ${puzzle.distances[state]} moves from here. Practice hint used.`;return true;
}
$('hint').onclick=showHint;$('random-puzzle').onclick=nextPuzzle;$('continue').onclick=nextPuzzle;
modes.forEach(name=>$('mode-'+name).onclick=()=>setMode(name));
$('share').onclick=async()=>{
  const text=resultText();if(!text)return;
  try{await navigator.clipboard.writeText(text);$('share-status').textContent='Result copied. No wiring or solution spoilers.'}
  catch{$('share-fallback').value=text;$('share-fallback').hidden=false;$('share-fallback').focus();$('share-fallback').select();$('share-status').textContent='Select and copy your result below.'}
};
$('view-board').onclick=()=>{$('success').hidden=true;$('show-result').focus()};$('show-result').onclick=()=>{$('success').hidden=false;(mode==='daily'?$('share'):$('continue')).focus()};$('new-day').onclick=startDay;
$('help').onclick=()=>$('instructions').showModal();$('close').onclick=$('play').onclick=()=>$('instructions').close();
document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||e.repeat||$('instructions').open||$('leaderboards').open||stopped()||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;const index=KEYS.indexOf(e.key.toLowerCase());if(index>=0&&e.key.length===1){e.preventDefault();flip(index)}});
window.addEventListener('storage',e=>{if(e.key===key()&&mode==='daily'){restore();render(stopped());$('status').textContent='Daily progress updated from another tab.'}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)clock()});
const savedMode=stored('1023-selected-mode-colour-v2');setMode(modes.includes(savedMode)?savedMode:'daily');setInterval(clock,1000);
if(document.modelContext?.registerTool){const life=new AbortController();for(const tool of [
  {name:'read_circuit',description:'Read the active mode, circuit values, connections and progress. Endless includes the move budget and run score.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:read},
  {name:'flip_circuit_switch',description:'Activate a colour operation in the active mode. Every move counts. Endless ends at minimum + 2 moves if unsolved. Indices 0–13 map to keys 1–9, 0, Q, W, E, R.',inputSchema:{type:'object',properties:{index:{type:'integer',minimum:0,maximum:13}},required:['index'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>flip(input?.index)},
  {name:'select_game_mode',description:'Select Daily (no hints), Practice (random puzzles with hints), or Endless (minimum + 2 moves, no hints). Saves the current mode and resumes the selected mode.',inputSchema:{type:'object',properties:{mode:{type:'string',enum:modes}},required:['mode'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>setMode(input?.mode)}
]){try{Promise.resolve(document.modelContext.registerTool(tool,{signal:life.signal})).catch(()=>{})}catch{}}window.addEventListener('pagehide',()=>life.abort(),{once:true})}
