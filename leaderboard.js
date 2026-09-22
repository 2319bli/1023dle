/* Shared scores are optional; the puzzle itself still works offline. */
(() => {
  'use strict';
  const API = ['localhost', '127.0.0.1'].includes(location.hostname) ? '/api' : 'https://play-1023.pr141.chatgpt.site/api';
  const PROFILE_KEY = '1023-player-v1', RULES = 'colour-v2';
  let profile = load(PROFILE_KEY), tab = 'daily', intent = null, loading = 0, busy = false;
  let syncError = '', failedRound = '', pendingRound = '', dailyBusy = false;
  function load(key) { try { return JSON.parse(stored(key) || 'null'); } catch { return null; } }
  if (!profile || !/^[a-f0-9]{64}$/.test(profile.token || '')) profile = null;
  const joined = () => !!profile?.id;
  const roundKey = r => r ? `${r.id}:${r.round}` : '';
  async function request(endpoint, data) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(API + endpoint, {
        method: data === undefined ? 'GET' : 'POST',
        headers: { ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...(profile && (!endpoint.startsWith('/leaderboard') || joined()) ? { Authorization: 'Bearer ' + profile.token } : {}) },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }), signal: controller.signal, credentials: 'omit'
      });
      const result = await response.json();
      if (!response.ok) { const error = new Error(result.error || 'Could not sync your score.'); error.status = response.status; throw error; }
      return result;
    } catch (error) {
      if (error.status) throw error;
      throw new Error('Could not connect. Your progress is saved here; please retry when you’re online.');
    } finally { clearTimeout(timer); }
  }
  function profileUI() {
    $('player-form').hidden = joined();
    $('player-label').textContent = joined() ? `Playing as ${profile.nickname}` : 'Choose a name to join the leaderboards.';
    $('board-action').textContent = intent === 'daily' ? 'Submit Daily score ↗' : intent === 'play-daily' ? 'Play today’s Daily ↗' : 'Play ranked Endless ↗';
    $('board-action').disabled = busy || dailyBusy || (intent !== 'play-daily' && !joined());
    $('save-player').disabled = busy;
  }
  function openBoard(which = mode === 'endless' ? 'endless' : 'daily', action = null) {
    tab = which; intent = action || (tab === 'daily' ? mode === 'daily' && complete ? 'daily' : 'play-daily' : 'endless');
    if (!$('leaderboards').open) $('leaderboards').showModal();
    $('player-status').textContent = '';
    profileUI(); refreshBoard();
    if (action && !joined()) $('player-name').focus();
  }
  async function refreshBoard() {
    const serial = ++loading, selected = tab;
    $('board-daily').setAttribute('aria-pressed', String(tab === 'daily'));
    $('board-endless').setAttribute('aria-pressed', String(tab === 'endless'));
    $('board-description').textContent = tab === 'daily' ? 'Fewest moves wins. One submitted result per player, per day.' : 'Every circuit cleared in ranked Endless adds to your lifetime total — across all runs.';
    $('board-date').textContent = tab === 'daily' ? `${dateNow()} · resets at 00:00 UTC` : 'All time · most circuits wins';
    $('board-score-label').textContent = tab === 'daily' ? 'Moves' : 'Circuits';
    $('board-status').textContent = 'Loading scores…'; $('board-table-wrap').hidden = true;
    try {
      const data = await request('/leaderboard?mode=' + selected);
      if (serial !== loading) return;
      $('board-rows').replaceChildren();
      for (const entry of data.entries) {
        const row = document.createElement('tr');
        if (entry.id === profile?.id) row.className = 'is-me';
        for (const value of [entry.rank, entry.nickname + (entry.id === profile?.id ? ' (you)' : ''), entry.score.toLocaleString()]) {
          const cell = document.createElement('td'); cell.textContent = String(value); row.append(cell);
        }
        $('board-rows').append(row);
      }
      $('board-status').textContent = data.totalPlayers ? `${data.totalPlayers.toLocaleString()} player${data.totalPlayers === 1 ? '' : 's'} · showing the top 50` : 'No scores yet. Make the first connection.';
      $('board-table-wrap').hidden = !data.totalPlayers;
      $('board-own').textContent = data.me ? `Your rank: ${data.me.rank} · ${data.me.score.toLocaleString()} ${selected === 'daily' ? 'moves' : data.me.score === 1 ? 'lifetime circuit' : 'lifetime circuits'}` : joined() ? 'Your first score will appear here.' : '';
    } catch (error) { if (serial === loading) $('board-status').textContent = error.message; }
  }
  async function submitDaily() {
    if (mode !== 'daily' || !complete || hinted) { $('player-status').textContent = 'Solve today’s Daily puzzle first.'; return; }
    if (!joined()) { openBoard('daily', 'daily'); return; }
    if (dailyBusy) return;
    const snapshot = { date: puzzle.date, path: [...path], rules: RULES };
    dailyBusy = true; refresh(); profileUI();
    try {
      const result = await request('/daily', snapshot);
      write('1023-daily-posted:' + snapshot.date, JSON.stringify({ id: profile.id, moves: result.moves }));
      $('player-status').textContent = `Daily score submitted: ${result.moves} moves.`;
      if ($('leaderboards').open) refreshBoard();
    } catch (error) { $('score-status').textContent = error.message; $('player-status').textContent = error.message; }
    finally { dailyBusy = false; refresh(false); profileUI(); }
  }
  function installRun(run) {
    // Mode changes retain each mode’s own save, including a pending online round.
    if (puzzle) save();
    mode = 'endless'; rankedRun = { ...run }; seed = run.seed; cleared = run.cleared;
    puzzle = P.generate('1023-endless-colour-v2:' + seed); resetState();
    syncError = ''; failedRound = '';
    write('1023-selected-mode-colour-v2', mode); save(); buildBoard();
  }
  async function startRanked() {
    if (!joined()) { openBoard('endless', 'endless'); return; }
    if (busy) return;
    busy = true; profileUI(); refresh();
    try {
      const run = await request('/runs', {});
      const saved = load('1023-endless-colour-v2');
      if (saved?.rankedRun?.id === run.id && saved.rankedRun.round === run.round && saved.seed === run.seed) {
        // Returning from another mode resumes locally saved moves, not a fresh board.
        setMode('endless');
      } else installRun(run);
      $('leaderboards').close();
    } catch (error) { $('player-status').textContent = error.message; $('ranked-note').textContent = error.message; }
    finally { busy = false; profileUI(); refresh(); }
  }
  function storeReceipt(snapshot, next) {
    if (mode === 'endless' && roundKey(rankedRun) === roundKey(snapshot)) {
      rankedRun.next = next; save();
    } else {
      const saved = load('1023-endless-colour-v2');
      if (roundKey(saved?.rankedRun) === roundKey(snapshot)) {
        saved.rankedRun.next = next; write('1023-endless-colour-v2', JSON.stringify(saved));
      }
    }
  }
  async function syncRound() {
    if (mode !== 'endless' || !rankedRun || !stopped()) return null;
    if (rankedRun.next) return rankedRun.next;
    const snapshot = { ...rankedRun }, moves = [...path], key = roundKey(snapshot);
    if (pendingRound) return null;
    pendingRound = key; syncError = ''; failedRound = ''; refresh(false);
    try {
      const next = await request(`/runs/${snapshot.id}/round`, { round: snapshot.round, path: moves, rules: RULES });
      storeReceipt(snapshot, next);
      if ($('leaderboards').open) refreshBoard();
      return next;
    } catch (error) { syncError = error.message; failedRound = key; return null; }
    finally { pendingRound = ''; refresh(false); }
  }
  async function advance() {
    const current = roundKey(rankedRun), next = await syncRound();
    if (mode !== 'endless' || current !== roundKey(rankedRun) || !next) return;
    if (next.ended) await startRanked(); else installRun(next);
  }
  async function resumeRun() {
    if (!rankedRun || busy) return;
    const current = roundKey(rankedRun), id = rankedRun.id;
    busy = true;
    try {
      const run = await request('/runs/' + id);
      if (mode !== 'endless' || current !== roundKey(rankedRun)) return;
      if (run.ended) { busy = false; await startRanked(); }
      else installRun(run);
    } catch (error) { syncError = error.message; }
    finally { busy = false; refresh(false); }
  }
  function refresh(autoSync = true) {
    $('ranked-strip').hidden = mode !== 'endless';
    $('start-ranked').hidden = !!rankedRun;
    $('start-ranked').disabled = busy;
    $('ranked-note').textContent = rankedRun ? `Ranked run · ${profile?.nickname || 'your player'} · cleared circuits add to your lifetime total` : 'Start a fresh online run to add circuits to your lifetime total. Local runs don’t count.';
    $('submit-daily').hidden = !(mode === 'daily' && complete && !hinted);
    $('submit-daily').disabled = dailyBusy;
    const receipt = mode === 'daily' ? load('1023-daily-posted:' + puzzle.date) : null;
    const submitted = receipt?.id === profile?.id && !!receipt;
    $('submit-daily').textContent = submitted ? 'View Daily leaderboard ↗' : dailyBusy ? 'Submitting…' : 'Submit to Daily board ↗';
    $('retry-ranked').hidden = true; $('resume-ranked').hidden = true;
    if (mode === 'daily') {
      if (dailyBusy) $('score-status').textContent = 'Checking your solution…';
      else if (submitted) $('score-status').textContent = `On the Daily leaderboard · ${receipt.moves} moves`;
      else if (autoSync) $('score-status').textContent = complete ? 'Submit your first result under a public player name.' : '';
    } else if (mode === 'endless' && rankedRun && stopped()) {
      const key = roundKey(rankedRun);
      $('continue').disabled = pendingRound === key || busy;
      if (rankedRun.next) $('score-status').textContent = complete ? '✓ Circuit verified. +1 to your lifetime total.' : 'Run recorded. Your lifetime circuits stay with you.';
      else if (pendingRound === key) $('score-status').textContent = 'Verifying this circuit and syncing your score…';
      else if (failedRound === key) {
        $('score-status').textContent = syncError;
        $('retry-ranked').hidden = false; $('resume-ranked').hidden = false;
      } else if (autoSync) { void syncRound(); }
    } else { $('score-status').textContent = ''; $('continue').disabled = false; }
  }
  $('open-leaderboards').onclick = () => openBoard();
  $('close-leaderboards').onclick = () => $('leaderboards').close();
  $('board-daily').onclick = () => { tab = 'daily'; intent = mode === 'daily' && complete ? 'daily' : 'play-daily'; profileUI(); refreshBoard(); };
  $('board-endless').onclick = () => { tab = 'endless'; intent = 'endless'; profileUI(); refreshBoard(); };
  $('refresh-board').onclick = refreshBoard;
  $('start-ranked').onclick = startRanked;
  $('retry-ranked').onclick = () => { void syncRound(); };
  $('resume-ranked').onclick = resumeRun;
  $('submit-daily').onclick = () => {
    const receipt = load('1023-daily-posted:' + puzzle.date);
    if (receipt?.id === profile?.id && receipt) openBoard('daily'); else void submitDaily();
  };
  $('board-action').onclick = () => { if (intent === 'play-daily') { $('leaderboards').close(); setMode('daily'); } else if (intent === 'daily') void submitDaily(); else void startRanked(); };
  $('player-form').onsubmit = async event => {
    event.preventDefault(); if (busy) return;
    const nickname = $('player-name').value.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9 _-]{1,23}$/.test(nickname)) { $('player-status').textContent = 'Use 2–24 letters, numbers, spaces, underscores or hyphens.'; return; }
    if (!profile) {
      profile = { token: Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('') };
      // Save the token before sending; a lost response must not lose the player account.
      if (!write(PROFILE_KEY, JSON.stringify(profile))) { profile = null; $('player-status').textContent = 'Enable browser storage to keep your leaderboard identity, then try again.'; return; }
    }
    busy = true; profileUI(); $('player-status').textContent = 'Setting up your player…';
    try {
      const user = await request('/players', { nickname });
      profile = { ...profile, ...user }; write(PROFILE_KEY, JSON.stringify(profile));
      $('player-status').textContent = 'You’re ready. Your name and submitted scores will be public.';
      refreshBoard();
    } catch (error) { $('player-status').textContent = error.message; }
    finally { busy = false; profileUI(); refresh(); }
  };
  window.Leaderboards = { refresh, advance };
  profileUI(); refresh();
})();
