import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
// Single-file Worker: the exact same puzzle engine runs in the browser and on the server.
mkdirSync('dist/server', { recursive: true });
const puzzle = readFileSync('puzzle.js', 'utf8');
const assets = {};
for (const [file, type] of [['index.html', 'text/html; charset=utf-8'], ['style.css', 'text/css'], ['themes.css', 'text/css'], ['themes.js', 'text/javascript'], ['puzzle.js', 'text/javascript'], ['game.js', 'text/javascript'], ['leaderboard.js', 'text/javascript']]) {
  const source = existsSync('public/' + file) ? 'public/' + file : file;
  if (existsSync(source)) assets['/' + file] = { body: readFileSync(source, 'utf8'), type };
}
const worker = readFileSync('server/worker.mjs', 'utf8').replace("import P from '../puzzle.js';", puzzle + '\nconst P = globalThis.CircuitPuzzle;\nconst SITE_ASSETS = ' + JSON.stringify(assets) + ';');
writeFileSync('dist/server/index.js', worker);
