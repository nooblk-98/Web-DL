'use strict';

/**
 * Compress a downloaded site folder into public/sites/<name>.zip.
 *
 * Returns a promise so the caller can sequence "download -> compress -> done".
 * Stream errors are reported to the client and reject the promise instead of
 * being thrown inside a callback (which previously crashed the whole server).
 * If the job was cancelled mid-compression, the partial zip is removed and the
 * client is told "cancelled" rather than "done"/"error".
 */

const fs = require('fs');
const path = require('path');
const archiverLib = require('archiver');

const config = require('../config');
const activeJobs = require('../lib/activeJobs');

/**
 * @param {string} folderName - sanitized host folder under DOWNLOAD_ROOT
 * @param {import('socket.io').Server} io
 * @param {{token: string}} data
 * @returns {Promise<{file: string, bytes: number}>}
 */
module.exports = (folderName, io, data) =>
  new Promise((resolve, reject) => {
    const { token } = data;

    // Reject unsafe names defensively (path traversal, separators).
    if (!config.FOLDER_NAME_REGEX.test(folderName)) {
      const err = new Error('Refusing to archive an unsafe folder name.');
      io.emit(token, { status: 'error', message: err.message });
      return reject(err);
    }

    // Make sure the output directory exists (fresh clone / wiped dir).
    fs.mkdirSync(config.SITES_DIR, { recursive: true });

    const zipPath = path.join(config.SITES_DIR, `${folderName}.zip`);
    const sourceDir = path.join(config.DOWNLOAD_ROOT, folderName);

    const output = fs.createWriteStream(zipPath);
    const archive = archiverLib('zip', { zlib: { level: 9 } });

    activeJobs.set(token, { archive });

    const isCancelled = () => {
      const entry = activeJobs.get(token);
      return Boolean(entry && entry.cancelled);
    };

    let settled = false;
    const settle = (fn) => {
      if (settled) return;
      settled = true;
      fn();
    };

    output.on('close', () =>
      settle(() => {
        if (isCancelled()) {
          fs.unlink(zipPath, () => {});
          io.emit(token, { status: 'cancelled', message: 'Download cancelled.' });
          return resolve({ file: folderName, bytes: 0, cancelled: true });
        }
        const bytes = archive.pointer();
        io.emit(token, { status: 'done', file: folderName, bytes });
        resolve({ file: folderName, bytes });
      })
    );

    const fail = (err) =>
      settle(() => {
        archive.abort();
        if (isCancelled()) {
          fs.unlink(zipPath, () => {});
          io.emit(token, { status: 'cancelled', message: 'Download cancelled.' });
          return resolve({ file: folderName, bytes: 0, cancelled: true });
        }
        io.emit(token, { status: 'error', message: err.message });
        reject(err);
      });

    output.on('error', fail);
    archive.on('error', fail);

    // Non-blocking warnings (e.g. a vanished file): log, don't crash.
    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') console.warn('archiver warning:', err.message);
      else fail(err);
    });

    // Surface compression progress so the UI can show a real bar.
    archive.on('progress', (p) => {
      io.emit(token, {
        status: 'compressing',
        processed: p.fs.processedBytes,
        total: p.fs.totalBytes,
      });
    });

    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
