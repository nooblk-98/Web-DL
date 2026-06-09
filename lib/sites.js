'use strict';

/**
 * Helpers for the generated zip files in public/sites.
 *
 * One place owns listing, safe path resolution (traversal-proof) and deletion,
 * so the history route and the cleanup sweeper share identical, audited rules.
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const config = require('../config');

/** List available zips, newest first, with size and modified time. */
async function listZips() {
  await fsp.mkdir(config.SITES_DIR, { recursive: true });
  const names = await fsp.readdir(config.SITES_DIR);
  const stats = await Promise.all(
    names
      .filter((n) => n.toLowerCase().endsWith('.zip'))
      .map(async (name) => {
        try {
          const s = await fsp.stat(path.join(config.SITES_DIR, name));
          return { name, size: s.size, modified: s.mtimeMs };
        } catch {
          return null;
        }
      })
  );
  return stats.filter(Boolean).sort((a, b) => b.modified - a.modified);
}

/**
 * Resolve a user-supplied zip name to an absolute path, but only if it is a
 * safe filename that stays inside SITES_DIR. Returns null otherwise.
 * @param {string} name
 * @returns {string|null}
 */
function safeZipPath(name) {
  if (typeof name !== 'string' || !config.ZIP_NAME_REGEX.test(name)) return null;
  const base = path.resolve(config.SITES_DIR);
  const resolved = path.resolve(base, name);
  if (resolved !== path.join(base, name)) return null; // no traversal/segments
  return resolved;
}

/** Delete a zip by name. @returns {Promise<boolean>} */
async function deleteZip(name) {
  const target = safeZipPath(name);
  if (!target) return false;
  try {
    await fsp.unlink(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove zips older than ttlMs. @returns {Promise<number>} count removed.
 */
async function sweepOldZips(ttlMs = config.ZIP_TTL_MS, now = Date.now()) {
  const files = await listZips();
  let removed = 0;
  for (const f of files) {
    if (now - f.modified > ttlMs) {
      if (await deleteZip(f.name)) removed += 1;
    }
  }
  return removed;
}

module.exports = { listZips, safeZipPath, deleteZip, sweepOldZips };
