'use strict';

/**
 * Socket.IO layer: receive download requests, validate them, enforce
 * concurrency, and wire up real cancellation.
 *
 * All progress for a request is emitted on a channel named after the client's
 * random `token`, as { status, ... } messages.
 */

const runDownload = require('../wget');
const { removeDownloadFolder } = require('../wget');
const { validateAndResolveUrl } = require('../lib/urlGuard');
const activeJobs = require('../lib/activeJobs');
const queue = require('../lib/jobQueue').instance;

/**
 * Cancel a job whether it is queued (not yet started) or actively running.
 * @param {string} token
 */
function cancelJob(token) {
  // Still queued? Drop it before it ever starts.
  if (queue.remove(token)) {
    activeJobs.delete(token);
    return;
  }

  const entry = activeJobs.get(token);
  if (!entry) return;

  entry.cancelled = true; // mutate the live entry; wget/archiver read this flag
  if (entry.child) entry.child.kill('SIGTERM');
  if (entry.archive) {
    try {
      entry.archive.abort();
    } catch {
      /* already finalised */
    }
    removeDownloadFolder(entry.folderName);
  }
}

module.exports = (io) => {
  io.on('connection', (socket) => {
    // Track tokens issued on this connection so disconnect can clean them up.
    socket.tokens = new Set();

    socket.on('request', async (data) => {
      const token = data && data.token;
      if (!token) return;
      socket.tokens.add(token);

      let validated;
      try {
        validated = await validateAndResolveUrl(data && data.website);
      } catch (err) {
        io.emit(token, { status: 'error', message: err.message });
        return;
      }

      const job = {
        token,
        url: validated.url,
        folderName: validated.folderName,
        options: (data && data.options) || {},
      };

      console.log('Download request %s -> %s', token, job.url);
      const { state } = queue.submit(token, () => runDownload(io, job));

      if (state === 'busy') {
        io.emit(token, {
          status: 'busy',
          message: 'A download for this session is already in progress.',
        });
      } else if (state === 'queued') {
        io.emit(token, {
          status: 'queued',
          message: 'Server is busy — your download is queued and will start shortly.',
        });
      }
    });

    socket.on('cancel', (data) => {
      const token = data && data.token;
      if (token) cancelJob(token);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected');
      for (const token of socket.tokens) cancelJob(token);
    });
  });
};
