import P from '../puzzle.js';

const RULES = 'colour-v2';
const ORIGINS = new Set(['https://2319bli.github.io', 'https://play-1023.pr141.chatgpt.site']);
const today = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
const reject = (status, message) => { throw new ApiError(status, message); };
async function hash(text) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), b => b.toString(16).padStart(2, '0')).join('');
}
function token(request) {
  const value = request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!value) reject(401, 'Set up your player name to submit scores.');
  return value;
}
async function player(request, db) {
  const value = await db.prepare('SELECT id, nickname FROM players WHERE token_hash = ?').bind(await hash(token(request))).first();
  if (!value) reject(401, 'Player not found. Set up your name again.');
  return value;
}
async function body(request) {
  // Bound the stream as well as Content-Length (which need not be supplied).
  const reader = request.body?.getReader();
  if (!reader) reject(400, 'Missing request body.');
  const chunks = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.length;
    if (size > 32768) { await reader.cancel(); reject(413, 'Submission is too large.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
  try { const data = JSON.parse(new TextDecoder().decode(bytes)); if (data && typeof data === 'object' && !Array.isArray(data)) return data; } catch {}
  reject(400, 'Invalid JSON.');
}
function replay(puzzle, path, max) {
  if (!Array.isArray(path) || path.length > max) reject(400, 'Invalid move history.');
  try { return P.stateFrom(puzzle, path); } catch { reject(400, 'Invalid move history.'); }
}
async function rateLimit(request, db, category, limit) {
  const bucket = `${category}:${Math.floor(Date.now() / 3600000)}:${await hash(request.headers.get('CF-Connecting-IP') || 'unknown')}`;
  const row = await db.prepare('INSERT INTO rate_limits (bucket, hits, expires) VALUES (?, 1, ?) ON CONFLICT(bucket) DO UPDATE SET hits = hits + 1 RETURNING hits').bind(bucket, Date.now() + 7200000).first();
  if (row.hits > limit) reject(429, 'Too many requests. Please try again later.');
  await db.prepare('DELETE FROM rate_limits WHERE expires < ?').bind(Date.now()).run();
}
function runView(run) { return { id: run.id, seed: run.seed, round: run.round, cleared: run.cleared, ended: !!run.ended, rules: RULES }; }
async function route(request, env, url) {
  const db = env.DB;
  if (!db) reject(503, 'Leaderboard is temporarily unavailable. Your local game still works.');
  const endpoint = url.pathname, method = request.method;
  if (endpoint === '/api/health' && method === 'GET') {
    await db.prepare('SELECT id FROM players LIMIT 1').first();
    return { ok: true, rules: RULES, date: today() };
  }
  if (endpoint === '/api/players' && method === 'POST') {
    const tokenHash = await hash(token(request));
    const existing = await db.prepare('SELECT id, nickname FROM players WHERE token_hash = ?').bind(tokenHash).first();
    if (existing) return existing;
    const { nickname } = await body(request);
    if (typeof nickname !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9 _-]{1,23}$/.test(nickname) || nickname !== nickname.trim()) reject(400, 'Use 2–24 letters, numbers, spaces, underscores or hyphens.');
    await rateLimit(request, db, 'players', 10);
    const id = uid();
    await db.prepare('INSERT INTO players (id, nickname, token_hash, created_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING').bind(id, nickname, tokenHash, now()).run();
    const saved = await db.prepare('SELECT id, nickname FROM players WHERE token_hash = ?').bind(tokenHash).first();
    if (!saved) reject(409, 'That name is taken. Try another.');
    return saved;
  }
  if (endpoint === '/api/leaderboard' && method === 'GET') {
    const kind = url.searchParams.get('mode');
    let me = null;
    if (request.headers.has('Authorization')) me = await player(request, db);
    let query, params = [], date = null;
    if (kind === 'daily') {
      date = url.searchParams.get('date') || today();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date + 'T00:00:00Z')) || date > today()) reject(400, 'Invalid daily date.');
      query = `SELECT p.id, p.nickname, s.moves AS score, RANK() OVER (ORDER BY s.moves ASC) AS rank FROM daily_scores s JOIN players p ON p.id = s.player_id WHERE s.date = ?`;
      params = [date];
    } else if (kind === 'endless') {
      query = `SELECT p.id, p.nickname, SUM(r.cleared) AS score, RANK() OVER (ORDER BY SUM(r.cleared) DESC) AS rank FROM runs r JOIN players p ON p.id = r.player_id GROUP BY p.id HAVING SUM(r.cleared) > 0`;
    } else reject(400, 'Choose daily or endless.');
    const rows = await db.prepare(`SELECT * FROM (${query}) ORDER BY rank, nickname COLLATE NOCASE LIMIT 50`).bind(...params).all();
    const own = me ? await db.prepare(`SELECT * FROM (${query}) WHERE id = ?`).bind(...params, me.id).first() : null;
    const count = await db.prepare(`SELECT COUNT(*) AS total FROM (${query})`).bind(...params).first();
    return { mode: kind, date, entries: rows.results, me: own, player: me, totalPlayers: count.total };
  }
  const user = await player(request, db);
  if (endpoint === '/api/daily' && method === 'POST') {
    const data = await body(request);
    if (data.rules !== RULES || data.date !== today()) reject(400, 'Only today’s puzzle can be submitted (00:00 UTC rollover).');
    const existing = await db.prepare('SELECT moves FROM daily_scores WHERE date = ? AND player_id = ?').bind(data.date, user.id).first();
    if (existing) return { moves: existing.moves, alreadySubmitted: true };
    const puzzle = P.daily(data.date);
    if (replay(puzzle, data.path, 10000) !== puzzle.targetState) reject(400, 'Solve the daily puzzle before submitting.');
    await db.prepare('INSERT INTO daily_scores (date, player_id, moves, created_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING').bind(data.date, user.id, data.path.length, now()).run();
    return await db.prepare('SELECT moves FROM daily_scores WHERE date = ? AND player_id = ?').bind(data.date, user.id).first();
  }
  if (endpoint === '/api/runs' && method === 'POST') {
    const active = await db.prepare('SELECT * FROM runs WHERE player_id = ? AND ended = 0').bind(user.id).first();
    if (active) return runView(active);
    await rateLimit(request, db, 'runs', 240);
    await db.prepare('INSERT INTO runs (id, player_id, seed, round, cleared, ended, created_at) VALUES (?, ?, ?, 0, 0, 0, ?) ON CONFLICT DO NOTHING').bind(uid(), user.id, uid(), now()).run();
    return runView(await db.prepare('SELECT * FROM runs WHERE player_id = ? AND ended = 0').bind(user.id).first());
  }
  const match = endpoint.match(/^\/api\/runs\/([a-f0-9-]{36})(\/round)?$/);
  if (match) {
    const run = await db.prepare('SELECT * FROM runs WHERE id = ? AND player_id = ?').bind(match[1], user.id).first();
    if (!run) reject(404, 'Run not found.');
    if (method === 'GET' && !match[2]) return runView(run);
    if (method === 'POST' && match[2]) {
      const data = await body(request);
      if (data.rules !== RULES || !Number.isSafeInteger(data.round) || data.round < 0 || !Array.isArray(data.path) || data.path.length > 20) reject(400, 'Invalid round submission.');
      const pathHash = await hash(JSON.stringify(data.path));
      const receipt = await db.prepare('SELECT path_hash, response FROM rounds WHERE run_id = ? AND round = ?').bind(run.id, data.round).first();
      if (receipt) {
        if (receipt.path_hash !== pathHash) reject(409, 'This circuit has already been recorded with different moves. Resume the saved run.');
        return JSON.parse(receipt.response);
      }
      if (run.ended || run.round !== data.round) reject(409, 'This run has moved on. Resume the saved run.');
      const puzzle = P.generate('1023-endless-colour-v2:' + run.seed);
      const finalState = replay(puzzle, data.path, puzzle.par + 2), solved = finalState === puzzle.targetState;
      if (!solved && data.path.length !== puzzle.par + 2) reject(400, 'Finish this circuit before advancing.');
      const next = { id: run.id, seed: solved ? uid() : run.seed, round: run.round + 1, cleared: run.cleared + Number(solved), ended: !solved, rules: RULES };
      // D1 batches are atomic. The receipt wins the race; its exact path gates the update.
      await db.batch([
        db.prepare(`INSERT INTO rounds (run_id, round, path_hash, response) SELECT id, round, ?, ? FROM runs WHERE id = ? AND round = ? AND ended = 0 ON CONFLICT DO NOTHING`).bind(pathHash, JSON.stringify(next), run.id, data.round),
        db.prepare(`UPDATE runs SET seed = ?, round = ?, cleared = ?, ended = ? WHERE id = ? AND round = ? AND EXISTS (SELECT 1 FROM rounds WHERE run_id = ? AND round = ? AND path_hash = ?)`).bind(next.seed, next.round, next.cleared, Number(next.ended), run.id, data.round, run.id, data.round, pathHash)
      ]);
      const saved = await db.prepare('SELECT path_hash, response FROM rounds WHERE run_id = ? AND round = ?').bind(run.id, data.round).first();
      if (!saved || saved.path_hash !== pathHash) reject(409, 'This circuit has already been recorded with different moves. Resume the saved run.');
      return JSON.parse(saved.response);
    }
  }
  reject(404, 'Endpoint not found.');
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      const asset = typeof SITE_ASSETS !== 'undefined' ? SITE_ASSETS[url.pathname === '/' ? '/index.html' : url.pathname] : null;
      if (asset) return new Response(asset.body, { headers: { 'Content-Type': asset.type } });
      return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
    }
    const origin = request.headers.get('Origin');
    const allowed = !origin || ORIGINS.has(origin) || (env.DEV && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin));
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' };
    if (origin && allowed) headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
    headers['Access-Control-Max-Age'] = '86400';
    try {
      if (!allowed) reject(403, 'Origin not allowed.');
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
      if (!['GET', 'POST'].includes(request.method)) reject(405, 'Method not allowed.');
      return new Response(JSON.stringify(await route(request, env, url)), { headers });
    } catch (error) {
      if (!(error instanceof ApiError)) console.error('Leaderboard request failed:', error.message);
      return new Response(JSON.stringify({ error: error instanceof ApiError ? error.message : 'Leaderboard is temporarily unavailable. Please retry.' }), { status: error.status || 503, headers });
    }
  }
};
