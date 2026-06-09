'use strict';

/* Manual cancel check: start a slowed download, cancel it mid-flight, and
   confirm we receive a 'cancelled' status. Run: node scripts/cancel-check.js */

const io = require('socket.io-client');

const BASE = process.env.BASE || 'http://localhost:3000';
const TARGET = process.env.TARGET || 'https://www.iana.org';

const socket = io.connect(BASE, { forceNew: true });
const token = 'cancel-' + Math.floor(Math.random() * 1e6);
let sawDownloading = false;
let cancelled = false;

const finish = (verdict) => {
  socket.close();
  console.log(`\nRESULT: ${verdict}`);
  process.exit(0);
};

const timer = setTimeout(() => finish(cancelled ? 'CANCELLED-OK' : 'TIMEOUT'), 30000);

socket.on('connect', () => {
  // waitSeconds slows wget between requests so there's time to cancel.
  socket.emit('request', { token, website: TARGET, options: { waitSeconds: 2, depth: 2 } });
});

socket.on(token, (event) => {
  if (event.status === 'downloading' && !sawDownloading) {
    sawDownloading = true;
    console.log('downloading started — sending cancel in 1s');
    setTimeout(() => socket.emit('cancel', { token }), 1000);
  }
  if (event.status === 'cancelled') {
    cancelled = true;
    clearTimeout(timer);
    console.log('received cancelled:', event.message);
    finish('CANCELLED-OK');
  }
  if (event.status === 'done') {
    clearTimeout(timer);
    finish('COMPLETED-BEFORE-CANCEL');
  }
  if (event.status === 'error') {
    clearTimeout(timer);
    finish('ERROR: ' + event.message);
  }
});
