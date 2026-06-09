'use strict';

/**
 * In-memory concurrency control for downloads.
 *
 * Caps how many wget processes run at once (global), rejects a second job for a
 * token that is already busy, and queues the overflow — draining as slots free
 * up. Hand-rolled on purpose: the popular alternatives (p-queue) are ESM-only
 * and this is a CommonJS codebase.
 */

const config = require('../config');

class JobQueue {
  /** @param {number} max - max concurrent jobs */
  constructor(max = config.MAX_CONCURRENT_DOWNLOADS) {
    this.max = Math.max(1, max);
    this.active = new Set(); // tokens currently running
    this.tokens = new Map(); // token -> 'active' | 'queued'
    this.waiting = []; // [{ token, run }]
  }

  /** @returns {boolean} whether the token has a running or queued job */
  has(token) {
    return this.tokens.has(token);
  }

  /**
   * Submit a job. `run` is invoked (returning a promise) when a slot is free;
   * the slot is released when that promise settles.
   *
   * @param {string} token
   * @param {() => Promise<unknown>} run
   * @returns {{state: 'started' | 'queued' | 'busy'}}
   */
  submit(token, run) {
    if (this.tokens.has(token)) return { state: 'busy' };

    if (this.active.size < this.max) {
      this._start(token, run);
      return { state: 'started' };
    }

    this.waiting.push({ token, run });
    this.tokens.set(token, 'queued');
    return { state: 'queued' };
  }

  /**
   * Remove a job that is still queued (not yet started), e.g. on cancel.
   * @returns {boolean} true if a queued job was removed
   */
  remove(token) {
    const idx = this.waiting.findIndex((w) => w.token === token);
    if (idx === -1) return false;
    this.waiting.splice(idx, 1);
    this.tokens.delete(token);
    return true;
  }

  _start(token, run) {
    this.active.add(token);
    this.tokens.set(token, 'active');
    Promise.resolve()
      .then(run)
      .catch(() => {}) // job-level errors are reported to the client by `run`
      .finally(() => this._finish(token));
  }

  _finish(token) {
    this.active.delete(token);
    this.tokens.delete(token);
    this._drain();
  }

  _drain() {
    while (this.active.size < this.max && this.waiting.length) {
      const next = this.waiting.shift();
      this._start(next.token, next.run);
    }
  }
}

module.exports = JobQueue;
module.exports.instance = new JobQueue();
