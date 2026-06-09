'use strict';

/**
 * Run a wget mirror for one job, stream progress to the client, then hand the
 * downloaded folder to the archiver.
 *
 * Security: the URL is validated upstream (lib/urlGuard) and wget is launched
 * with spawn() + an argument array (lib/wgetArgs) — never an interpolated
 * shell string — so user input can never be interpreted as a shell command.
 *
 * wget flag reference:
 *   --mirror            recursive download
 *   --convert-links     rewrite links to relative for offline viewing
 *   --adjust-extension  add .html/.css by content-type
 *   --page-requisites   fetch CSS/JS/images needed to render
 *   --no-parent         stay within the starting path
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const config = require('../config');
const archiver = require('../archiver');
const activeJobs = require('../lib/activeJobs');
const { buildWgetArgs } = require('../lib/wgetArgs');

/** Remove a downloaded mirror folder (after cancel, or once it has been zipped). */
function removeDownloadFolder(folderName) {
  if (!folderName || !config.FOLDER_NAME_REGEX.test(folderName)) return;
  const directory = path.join(config.DOWNLOAD_ROOT, folderName);
  fs.rm(directory, { recursive: true, force: true }, (err) => {
    if (err) console.error(`Error removing download folder: ${err.message}`);
  });
}

/**
 * @param {import('socket.io').Server} io
 * @param {{token: string, url: string, folderName: string, options?: object}} job
 * @returns {Promise<void>} resolves when the job ends (success, error or cancel)
 */
module.exports = (io, job) =>
  new Promise((resolve) => {
    const { token } = job;
    const args = buildWgetArgs(job.url, job.options);

    fs.mkdirSync(config.DOWNLOAD_ROOT, { recursive: true });
    const child = spawn('wget', args, { cwd: config.DOWNLOAD_ROOT });
    activeJobs.set(token, { child, folderName: job.folderName, cancelled: false });

    let detectedFolder = '';
    let fileCount = 0;

    io.emit(token, { status: 'downloading', message: `Starting download of ${job.url}` });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();

      // The real on-disk folder is the first path segment wget saves into;
      // this is robust to www/redirect host changes. Fall back to the
      // hostname derived from the validated URL.
      if (!detectedFolder) {
        const m = text.match(/Saving to: ['"]([^/'"]+)\//);
        if (m && m[1]) detectedFolder = m[1];
      }

      if (text.includes('200 OK')) fileCount += 1;

      const currentFile = (text.match(/Saving to: ['"]([^'"]+)['"]/) || [])[1];
      io.emit(token, {
        status: 'downloading',
        fileCount,
        currentFile,
        message: text,
      });
    });

    // Fires if the wget binary itself cannot be spawned.
    child.on('error', (err) => {
      io.emit(token, {
        status: 'error',
        message: `Could not start wget: ${err.message}. Is wget installed?`,
      });
      activeJobs.delete(token);
      resolve();
    });

    // 'close' (not 'exit') guarantees stderr has been fully drained.
    child.on('close', async (code, signal) => {
      const entry = activeJobs.get(token) || {};
      const folderName = detectedFolder || job.folderName;

      if (entry.cancelled || signal === 'SIGTERM') {
        removeDownloadFolder(folderName);
        io.emit(token, { status: 'cancelled', message: 'Download cancelled.' });
        activeJobs.delete(token);
        return resolve();
      }

      // wget exits non-zero for partial/server errors but may still have
      // mirrored usable files — archive whenever the folder exists.
      const sourceDir = folderName && path.join(config.DOWNLOAD_ROOT, folderName);
      if (!folderName || !fs.existsSync(sourceDir)) {
        io.emit(token, {
          status: 'error',
          message: `Download failed (wget exit ${code}); nothing to archive.`,
        });
        activeJobs.delete(token);
        return resolve();
      }

      io.emit(token, { status: 'compressing', file: folderName });
      try {
        await archiver(folderName, io, job);
        // Mirror is now zipped; drop the source folder to bound disk usage.
        removeDownloadFolder(folderName);
      } catch {
        // archiver already emitted a structured error to the client.
      } finally {
        activeJobs.delete(token);
        resolve();
      }
    });
  });

module.exports.removeDownloadFolder = removeDownloadFolder;
