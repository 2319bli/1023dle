import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../server/worker.mjs';
import P from '../puzzle.js';
import { database } from './d1.mjs';
const ORIGIN = 'https://2319bli.github.io', RULES = 'colour-v2';
const date = new Date().toISOString().slice(0, 10);
function solution(puzzle) { const moves = []; let state = puzzle.initial; while (state !== puzzle.targetState) { const i = puzzle.nextSwitch[state]; moves.push(i); state = P.apply(state, puzzle.operations[i]); } return moves; }
const roundPuzzle = run => P.generate('1023-endless-colour-v2:' + run.seed);
function setup() {
  const DB = database();
  async function api(path, data, token, origin = ORIGIN) {
    const headers = { Origin: origin, ...(token ? { Authorization: 'Bearer ' + token } : {}) };
    const response = await worker.fetch(new Request('https://scores.test/api' + path, { method: data === undefined ? 'GET' : 'POST', headers, ...(data === undefined ? {} : { body: JSON.stringify(data) }) }), { DB });
    return { status: response.status, data: await response.json(), headers: response.headers };
  }
  const create = (nickname, token) => api('/players', { nickname }, token);
  const finish = (run, path, token) => api(`/runs/${run.id}/round`, { round: run.round, path, rules: RULES }, token);
  return { DB, api, create, finish };
}
test('Public reads, CORS, nickname validation, identity and authentication', async () => {
  const { api, create } = setup(), token = 'a'.repeat(64);
  assert.equal((await api('/health')).status, 200);
  const empty = await api('/leaderboard?mode=endless'); assert.equal(empty.data.totalPlayers, 0); assert.equal(empty.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.equal((await api('/leaderboard?mode=daily', undefined, undefined, 'https://evil.example')).status, 403);
  assert.equal((await api('/daily', {})).status, 401);
  assert.equal((await create('<script>bad</script>', token)).status, 400);
  const alice = await create('Alice', token); assert.equal(alice.status, 200);
  assert.equal((await create('Alice', token)).data.id, alice.data.id);
  assert.equal((await create('aLiCe', 'b'.repeat(64))).status, 409);
  assert.equal((await api('/runs', {}, 'c'.repeat(64))).status, 401);
});
test('Daily validates completion and date, keeps first score, shares tied ranks', async () => {
  const { api, create } = setup(), a = 'a'.repeat(64), b = 'b'.repeat(64), puzzle = P.daily(date), moves = solution(puzzle);
  await create('Alice', a); await create('Bob', b);
  const submit = (path, token = a, day = date) => api('/daily', { date: day, path, rules: RULES, moves: 0 }, token);
  assert.equal((await submit([])).status, 400);
  assert.equal((await submit([null])).status, 400);
  assert.equal((await submit(moves, a, '2020-01-01')).status, 400);
  assert.equal((await submit([...moves, 0])).status, 400);
  const longer = [10, 10, ...moves];
  assert.equal((await submit(longer)).data.moves, moves.length + 2);
  assert.equal((await submit(moves)).data.moves, moves.length + 2);
  await submit(longer, b);
  const board = (await api('/leaderboard?mode=daily', undefined, a)).data;
  assert.equal(board.entries.length, 2); assert.deepEqual(board.entries.map(e => e.rank), [1, 1]); assert.equal(board.me.score, longer.length);
  assert.equal((await api('/leaderboard?mode=daily&date=2020-01-01')).data.entries.length, 0);
});
test('Endless verifies server circuits, counts exactly once, totals across all runs', async () => {
  const { api, create, finish } = setup(), token = 'a'.repeat(64), other = 'b'.repeat(64);
  await create('Alice', token); await create('Bob', other);
  const run = (await api('/runs', {}, token)).data;
  assert.equal((await api('/runs', {}, token)).data.id, run.id);
  assert.equal((await api(`/runs/${run.id}`, undefined, other)).status, 404);
  assert.equal((await finish(run, [], token)).status, 400);
  const puzzle = roundPuzzle(run), moves = solution(puzzle);
  assert.equal((await finish({ ...run, round: 100 }, moves, token)).status, 409);
  assert.equal((await finish(run, [10, 10, 10, 10, ...moves], token)).status, 400);
  const accepted = await finish(run, [10, 10, ...moves], token); assert.equal(accepted.status, 200); assert.equal(accepted.data.cleared, 1);
  const repeated = await finish(run, [10, 10, ...moves], token); assert.deepEqual(repeated.data, accepted.data);
  assert.equal((await finish(run, moves, token)).status, 409);
  const second = accepted.data, next = (await finish(second, solution(roundPuzzle(second)), token)).data;
  assert.equal(next.cleared, 2);
  const failed = (await finish(next, Array(roundPuzzle(next).par + 2).fill(10), token)).data;
  assert.equal(failed.ended, true); assert.equal(failed.cleared, 2);
  assert.equal((await finish(failed, solution(roundPuzzle(failed)), token)).status, 409);
  const fresh = (await api('/runs', {}, token)).data; assert.notEqual(fresh.id, run.id); assert.equal(fresh.cleared, 0);
  await finish(fresh, solution(roundPuzzle(fresh)), token);
  const board = (await api('/leaderboard?mode=endless', undefined, token)).data;
  assert.equal(board.me.score, 3); assert.equal(board.entries.length, 1);
});
test('Overlapping identical submissions cannot double-credit a circuit', async () => {
  // Force both requests through their initial reads before the atomic batches execute.
  const { DB, api, create, finish } = setup(), token = 'a'.repeat(64);
  const batch = DB.batch.bind(DB); let chain = Promise.resolve();
  DB.batch = statements => { const next = chain.then(() => batch(statements)); chain = next.catch(() => {}); return next; };
  await create('Alice', token); const run = (await api('/runs', {}, token)).data, moves = solution(roundPuzzle(run));
  const results = await Promise.all([finish(run, moves, token), finish(run, moves, token)]);
  assert(results.every(r => r.status === 200)); assert.deepEqual(results[0].data, results[1].data);
  assert.equal((await api('/leaderboard?mode=endless', undefined, token)).data.me.score, 1);
});
