'use strict';

/* Ad-hoc end-to-end check: drives the real socket flow against a running server.
   Not part of the test suite — run manually with: node scripts/e2e-check.js */

const io = require('socket.io-client');

const BASE = process.env.BASE || 'http://localhost:3000';

function runCase(name, website, options) {
  return new Promise((resolve) => {
    const socket = io.connect(BASE, { forceNew: true });
    const token = 'tok-' + name + '-' + Math.floor(Math.random() * 1e6);
    let last = null;
    const done = (verdict) => {
      socket.close();
      console.log(`\n[${name}] final: ${verdict} (last status: ${last})`);
      resolve({ name, verdict, last });
    };
    const timer = setTimeout(() => done('TIMEOUT'), 45000);

    socket.on('connect', () => {
      socket.emit('request', { token, website, options: options || {} });
    });
    socket.on(token, (event) => {
      last = event.status;
      if (event.status === 'error' || event.status === 'cancelled') {
        clearTimeout(timer);
        console.log(`[${name}] ${event.status}: ${event.message}`);
        done(event.status.toUpperCase());
      } else if (event.status === 'done') {
        clearTimeout(timer);
        console.log(`[${name}] done: ${event.file} (${event.bytes} bytes)`);
        done('DONE');
      } else if (event.status === 'downloading' && event.currentFile) {
        // keep quiet; just show we are progressing
      }
    });
  });
}

(async () => {
  // 1. SSRF guard must reject loopback.
  await runCase('ssrf-loopback', 'http://127.0.0.1:3000/');
  // 2. Injection attempt — must not run a shell; URL is rejected/neutralised.
  await runCase('injection', 'https://example.com; touch /tmp/pwned');
  // 3. Happy path against a small public site (needs network).
  await runCase('happy', 'https://example.com', { depth: 1 });
  process.exit(0);
})();
