'use strict';

/**
 * Periodic cleanup of old generated zips, so public/sites does not grow without
 * bound. Sweeps once on startup and then on an interval.
 */

const config = require('../config');
const { sweepOldZips } = require('./sites');

function start() {
  const run = () =>
    sweepOldZips()
      .then((n) => {
        if (n) console.log(`Cleanup: removed ${n} expired zip(s).`);
      })
      .catch((err) => console.error('Cleanup error:', err.message));

  run(); // startup sweep bounds disk even across frequent restarts
  const timer = setInterval(run, config.CLEANUP_INTERVAL_MS);
  if (typeof timer.unref === 'function') timer.unref();
  return timer;
}

module.exports = { start };
