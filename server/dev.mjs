import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import worker from './worker.mjs';
import { database } from '../tests/d1.mjs';
const DB = database(), port = Number(process.env.PORT || 4173);
const files = new Map([['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']], ['/style.css', ['style.css', 'text/css']], ['/puzzle.js', ['puzzle.js', 'text/javascript']], ['/game.js', ['game.js', 'text/javascript']], ['/leaderboard.js', ['leaderboard.js', 'text/javascript']]]);
createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const response = await worker.fetch(new Request(url, { method: req.method, headers: req.headers, ...(!['GET', 'HEAD'].includes(req.method) ? { body: Buffer.concat(chunks) } : {}) }), { DB, DEV: true });
      res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
    } else if (files.has(url.pathname)) {
      const [file, type] = files.get(url.pathname); res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(await readFile(file));
    } else { res.writeHead(404); res.end(); }
  } catch (error) { console.error(error); res.writeHead(500); res.end('Development server error'); }
}).listen(port, '127.0.0.1', () => console.log(`Game and local leaderboard: http://127.0.0.1:${port}`));
