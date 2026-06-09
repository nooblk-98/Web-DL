'use strict';

/**
 * Build the wget argument array from validated user options.
 *
 * Security model: the client never supplies raw flags. It supplies a typed
 * options object whose values are clamped/validated here and mapped to a fixed
 * allowlist of wget flags. The validated URL is always placed after a "--"
 * sentinel so it can never be interpreted as a flag.
 */

const config = require('../config');

const clampInt = (value, min, max, fallback) => {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

/**
 * Normalise a comma/space separated extension list into a clean, validated
 * array of tokens like ["html", "css", "png"]. Invalid tokens are dropped.
 * @param {string|string[]} input
 * @returns {string[]}
 */
function parseExtensions(input) {
  if (!input) return [];
  const tokens = Array.isArray(input) ? input : String(input).split(/[,\s]+/);
  return tokens
    .map((t) => String(t).trim().toLowerCase().replace(/^\./, ''))
    .filter((t) => config.EXTENSION_REGEX.test(t));
}

/**
 * @param {string} validatedUrl - already passed through lib/urlGuard
 * @param {object} [opts] - user options (untrusted, validated here)
 * @param {number} [opts.depth] - recursion depth (-l)
 * @param {boolean} [opts.pageRequisites=true] - include -p
 * @param {string|string[]} [opts.include] - accept extensions (-A)
 * @param {string|string[]} [opts.exclude] - reject extensions (-R)
 * @param {number} [opts.maxSizeMb] - download quota (-Q)
 * @param {boolean} [opts.followExternal=false] - span hosts (-H)
 * @param {number} [opts.waitSeconds] - wait between requests (-w)
 * @returns {string[]} the full argv for `spawn('wget', argv)`
 */
function buildWgetArgs(validatedUrl, opts = {}) {
  const { LIMITS } = config;
  const args = [...config.WGET_BASE_FLAGS];

  // Recursion depth: 0 means infinite in wget, so only set when provided.
  if (opts.depth !== undefined && opts.depth !== null && opts.depth !== '') {
    args.push('-l', String(clampInt(opts.depth, 0, LIMITS.MAX_DEPTH, 5)));
  }

  // Page requisites are on by default (already in base flags). Allow opting out.
  if (opts.pageRequisites === false) {
    const i = args.indexOf('--page-requisites');
    if (i !== -1) args.splice(i, 1);
  }

  // Following external hosts replaces --no-parent's containment; warn in UI.
  if (opts.followExternal === true) {
    args.push('--span-hosts');
  } else {
    args.push('--no-parent');
  }

  const include = parseExtensions(opts.include);
  if (include.length) args.push('-A', include.join(','));

  const exclude = parseExtensions(opts.exclude);
  if (exclude.length) args.push('-R', exclude.join(','));

  if (opts.maxSizeMb !== undefined && opts.maxSizeMb !== null && opts.maxSizeMb !== '') {
    const mb = clampInt(opts.maxSizeMb, 1, LIMITS.MAX_QUOTA_MB, LIMITS.MAX_QUOTA_MB);
    args.push('-Q', `${mb}m`);
  }

  if (opts.waitSeconds !== undefined && opts.waitSeconds !== null && opts.waitSeconds !== '') {
    const wait = clampInt(opts.waitSeconds, 0, LIMITS.MAX_WAIT_SECONDS, 0);
    if (wait > 0) args.push('-w', String(wait), '--random-wait');
  }

  // Limit redirect chains to blunt redirect-based SSRF (see lib/urlGuard.js).
  args.push('--max-redirect', '10');

  // "--" stops flag parsing: the URL can never be read as an option.
  args.push('--', validatedUrl);
  return args;
}

module.exports = { buildWgetArgs, parseExtensions };
