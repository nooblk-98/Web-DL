'use strict';

/**
 * Registry of in-flight downloads, keyed by client token.
 *
 * Holds a reference to the live wget child process and the archiver stream so
 * that the socket layer can actually cancel work on a Stop request or client
 * disconnect — the previous code referenced a process handle that was never
 * stored, so cancellation was silently dead.
 *
 * Entry shape: { child, archive, folderName, cancelled }
 */

const jobs = new Map();

module.exports = {
  /** Create or merge fields into a job entry. */
  set(token, fields) {
    jobs.set(token, Object.assign(jobs.get(token) || {}, fields));
  },
  get(token) {
    return jobs.get(token);
  },
  has(token) {
    return jobs.has(token);
  },
  delete(token) {
    jobs.delete(token);
  },
};
