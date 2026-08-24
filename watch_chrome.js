// node watch_chrome.js
//
// Opens the app in a real (visible) Chrome window and streams everything the page
// reports — the app's own log lines, console output, uncaught exceptions — to the
// terminal and to scratch/session_watch.log, so someone else (or Claude) can follow
// a live session and see exactly what happened.
//
// Uses a throwaway Chrome profile, so the browser you normally use is untouched.
// Stop with Ctrl+C.
//
//   node watch_chrome.js            open the app from file://
//   node watch_chrome.js --serve    serve over http://127.0.0.1:8765 instead
//
// The DevTools Protocol connection here is read-only: the Page domain is deliberately
// left disabled, because enabling it makes Chrome hand modal dialogs to the debugger
// instead of showing them to the user.

'use strict';
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CDP_PORT = 9444;
const HTTP_PORT = 8765;
const USE_SERVER = process.argv.includes('--serve');
const LOG_FILE = path.join(ROOT, 'scratch', 'session_watch.log');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'w' });

/** @param {string} line */
function emit(line) {
  const t = new Date().toTimeString().slice(0, 8);
  const text = `[${t}] ${line}`;
  console.log(text);
  logStream.write(text + '\n');
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
};

function startStaticServer() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT + path.sep)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  server.listen(HTTP_PORT, '127.0.0.1');
  return server;
}

let nextId = 0;
/**
 * @param {WebSocket} ws
 * @param {string} method
 * @param {any} [params]
 */
function cdp(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const onMessage = (/** @type {any} */ ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== id) return;
      ws.removeEventListener('message', onMessage);
      if (msg.error) reject(new Error(`${method}: ${msg.error.message}`));
      else resolve(msg.result);
    };
    ws.addEventListener('message', onMessage);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

(async () => {
  const server = USE_SERVER ? startStaticServer() : null;
  const url = USE_SERVER
    ? `http://127.0.0.1:${HTTP_PORT}/index.html`
    : `file://${path.join(ROOT, 'index.html')}`;

  const chrome = spawn(CHROME, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${path.join(ROOT, 'scratch', '.chrome-watch-profile')}`,
    '--no-first-run', '--no-default-browser-check',
    '--window-size=1500,1000',
    url,
  ], { stdio: 'ignore' });

  const cleanup = () => {
    try { chrome.kill(); } catch (e) { /* already gone */ }
    try { if (server) server.close(); } catch (e) { /* already gone */ }
    logStream.end();
  };
  process.on('SIGINT', () => { emit('--- watcher stopped ---'); cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { emit('--- watcher stopped ---'); cleanup(); process.exit(0); });

  emit(`opening ${url}`);
  emit(`log file: ${LOG_FILE}`);

  /** @type {any[]|null} */
  let targets = null;
  for (let i = 0; i < 80; i++) {
    await sleep(250);
    try {
      const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      targets = (await r.json()).filter((/** @type {any} */ t) => t.type === 'page' && !t.url.startsWith('devtools://'));
      if (targets.length) break;
    } catch (e) { /* not up yet */ }
  }
  if (!targets || !targets.length) {
    emit('ERROR: could not attach to Chrome');
    cleanup();
    process.exit(1);
  }

  const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', () => res(undefined), { once: true });
    ws.addEventListener('error', () => rej(new Error('CDP websocket failed')), { once: true });
  });

  ws.addEventListener('message', (/** @type {any} */ ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      emit(`JS EXCEPTION: ${(d.exception && d.exception.description) || d.text}`);
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args
        .map((/** @type {any} */ a) => (a.value !== undefined ? a.value : a.description || a.type))
        .join(' ');
      emit(`console.${msg.params.type}: ${text}`);
    } else if (msg.method === 'Log.entryAdded') {
      const e = msg.params.entry;
      emit(`browser ${e.level} (${e.source}): ${e.text}`);
    }
  });

  await cdp(ws, 'Runtime.enable');
  await cdp(ws, 'Log.enable');
  emit('--- attached. Use the Chrome window that just opened; everything it reports appears here. ---');

  // Mirror the app's own log panel, and report state transitions.
  let seen = 0;
  let lastSummary = '';
  for (;;) {
    await sleep(400);
    try {
      const res = /** @type {any} */ (await cdp(ws, 'Runtime.evaluate', {
        expression: `(() => {
          const lines = Array.from(document.querySelectorAll('#log div')).map((d) => d.textContent);
          const s = (typeof state === 'undefined') ? null : state;
          const summary = !s ? 'no app' : [
            'mode=' + s.mode,
            'source=' + (s.source ? s.source.kind + ':' + s.source.name + ' (' + s.source.frameCount + 'f)' : 'none'),
            'frame=' + (s.source ? (s.frameIndex + 1) : '-'),
            'calib=' + (s.transform ? 'yes' : 'no'),
            'points=' + (s.framesRaw ? s.framesRaw.reduce((n, p) => n + p.length, 0) : 0),
            'dialog=' + (document.querySelector('dialog[open]') ? document.querySelector('dialog[open]').id : 'none'),
            'guide=' + (document.getElementById('guide-text') || {}).textContent,
          ].join(' | ');
          return JSON.stringify({ lines, summary });
        })()`,
        returnByValue: true,
      }));
      if (res.exceptionDetails || !res.result || typeof res.result.value !== 'string') continue;
      const { lines, summary } = JSON.parse(res.result.value);
      if (lines.length < seen) seen = 0; // page was reloaded
      for (let i = seen; i < lines.length; i++) emit(`app log | ${lines[i]}`);
      seen = lines.length;
      if (summary !== lastSummary) {
        emit(`state    | ${summary}`);
        lastSummary = summary;
      }
    } catch (e) {
      // execution context replaced on reload, or the browser was closed
      if (chrome.exitCode !== null) {
        emit('--- Chrome closed. watcher stopping. ---');
        cleanup();
        process.exit(0);
      }
    }
  }
})();
