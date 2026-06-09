'use strict';

/**
 * Central configuration and constants.
 *
 * Every other module reads paths, limits and defaults from here instead of
 * hardcoding them, so behaviour can be tuned with environment variables and
 * there is a single source of truth.
 */

const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');

// wget mirrors each site into a host-named folder under here; the archiver then
// zips that folder. Kept in a dedicated (gitignored) directory so mirrors never
// pollute the repo root, and removed after archiving to bound disk usage.
const DOWNLOAD_ROOT = process.env.DOWNLOAD_ROOT || path.join(PROJECT_ROOT, 'downloads');

// Where generated .zip files are written and served from (via express.static).
const SITES_DIR = path.join(PROJECT_ROOT, 'public', 'sites');

const num = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

module.exports = {
  DOWNLOAD_ROOT,
  SITES_DIR,

  // Max wget processes running at once across the whole server.
  MAX_CONCURRENT_DOWNLOADS: num(process.env.MAX_CONCURRENT_DOWNLOADS, 3),

  // Auto-cleanup: delete zips older than this, swept on an interval.
  ZIP_TTL_MS: num(process.env.ZIP_TTL_MS, 24 * 60 * 60 * 1000),
  CLEANUP_INTERVAL_MS: num(process.env.CLEANUP_INTERVAL_MS, 60 * 60 * 1000),

  // Allow private / loopback hosts. OFF by default (SSRF protection); set
  // ALLOW_PRIVATE_HOSTS=true only for local testing against localhost.
  ALLOW_PRIVATE_HOSTS: String(process.env.ALLOW_PRIVATE_HOSTS).toLowerCase() === 'true',

  // Always-on wget flags. User options (lib/wgetArgs.js) extend these through a
  // strict allowlist — raw flags from the client are never accepted.
  WGET_BASE_FLAGS: [
    '--mirror', // -m  recursive download
    '--convert-links', // -k  rewrite links for offline viewing
    '--adjust-extension', // -E  add .html/.css extensions by content-type
    '--page-requisites', // -p  fetch CSS/JS/images needed to render
    '--no-if-modified-since',
  ],

  // Upper bounds for user-supplied download options (clamped, never trusted).
  LIMITS: {
    MAX_DEPTH: num(process.env.MAX_DEPTH, 10),
    MAX_QUOTA_MB: num(process.env.MAX_QUOTA_MB, 2048),
    MAX_WAIT_SECONDS: num(process.env.MAX_WAIT_SECONDS, 30),
  },

  // A single extension token (e.g. "html", "png"). Used to validate -A / -R.
  EXTENSION_REGEX: /^[a-z0-9]{1,8}$/,

  // A safe generated zip filename: hostname-ish plus ".zip", no path separators.
  ZIP_NAME_REGEX: /^[a-zA-Z0-9._:-]+\.zip$/,

  // A safe folder/host name: no "/" and no "..".
  FOLDER_NAME_REGEX: /^[a-zA-Z0-9._:-]+$/,
};
