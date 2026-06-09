'use strict';

/**
 * URL validation + SSRF protection.
 *
 * The server is the security boundary: every URL is validated here before wget
 * is ever launched. We allow only http/https public destinations and reject
 * anything that resolves to a private, loopback, link-local or otherwise
 * internal address (e.g. the cloud metadata endpoint 169.254.169.254).
 *
 * Residual risk: wget re-resolves DNS and follows redirects itself, so a
 * public host that 3xx-redirects to an internal address could still be reached.
 * That is mitigated separately in lib/wgetArgs.js via --max-redirect.
 */

const dns = require('dns').promises;
const ipaddr = require('ipaddr.js');
const config = require('../config');

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Resolve an ipaddr range, transparently unwrapping IPv4-mapped IPv6 so that
 * e.g. ::ffff:127.0.0.1 is classified by its embedded IPv4 address.
 * @param {string} addr - an IP literal
 * @returns {string} ipaddr.js range name ("unicast" === public/allowed)
 */
function addressRange(addr) {
  const parsed = ipaddr.parse(addr);
  if (parsed.kind() === 'ipv6' && parsed.isIPv4MappedAddress()) {
    return parsed.toIPv4Address().range();
  }
  return parsed.range();
}

/**
 * @param {string} addr - an IP literal
 * @returns {boolean} true if the address is NOT a public unicast address
 */
function isBlockedAddress(addr) {
  if (!ipaddr.isValid(addr)) return true;
  return addressRange(addr) !== 'unicast';
}

/**
 * Resolve a hostname to its IP addresses. IP literals are returned as-is so we
 * never depend on DNS for them.
 * @param {string} hostname
 * @returns {Promise<string[]>}
 */
async function resolveHost(hostname) {
  if (ipaddr.isValid(hostname)) return [hostname];
  const records = await dns.lookup(hostname, { all: true });
  return records.map((r) => r.address);
}

/** Derive the on-disk folder name wget will use (host[:port]). */
function folderNameFor(parsedUrl) {
  return parsedUrl.port ? `${parsedUrl.hostname}:${parsedUrl.port}` : parsedUrl.hostname;
}

/**
 * Validate a raw user URL and confirm it does not resolve to an internal
 * address. Throws ValidationError on any problem.
 *
 * @param {string} raw
 * @returns {Promise<{url: string, hostname: string, folderName: string}>}
 */
async function validateAndResolveUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new ValidationError('Please enter a website URL.');
  }
  const candidate = raw.trim();

  let parsed;
  try {
    parsed = new URL(/^https?:\/\//i.test(candidate) ? candidate : `http://${candidate}`);
  } catch {
    throw new ValidationError('That does not look like a valid URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ValidationError('Only http:// and https:// URLs are supported.');
  }
  if (parsed.username || parsed.password) {
    throw new ValidationError('URLs with embedded credentials are not allowed.');
  }
  if (!parsed.hostname) {
    throw new ValidationError('The URL is missing a hostname.');
  }

  if (!config.ALLOW_PRIVATE_HOSTS) {
    let addresses;
    try {
      addresses = await resolveHost(parsed.hostname);
    } catch {
      throw new ValidationError(`Could not resolve host "${parsed.hostname}".`);
    }
    if (addresses.some(isBlockedAddress)) {
      throw new ValidationError(
        'For security, this server refuses to download private, loopback or internal addresses.'
      );
    }
  }

  return {
    url: parsed.toString(),
    hostname: parsed.hostname,
    folderName: folderNameFor(parsed),
  };
}

module.exports = {
  validateAndResolveUrl,
  isBlockedAddress,
  addressRange,
  ValidationError,
};
