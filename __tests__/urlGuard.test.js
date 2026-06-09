'use strict';

// Mock DNS so tests never hit the network; each test sets the resolved address.
jest.mock('dns', () => ({ promises: { lookup: jest.fn() } }));
const dnsLookup = require('dns').promises.lookup;

const { validateAndResolveUrl, isBlockedAddress, ValidationError } = require('../lib/urlGuard');

const publicIp = () => dnsLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);

describe('isBlockedAddress', () => {
  it('allows public unicast addresses', () => {
    expect(isBlockedAddress('8.8.8.8')).toBe(false);
    expect(isBlockedAddress('1.1.1.1')).toBe(false);
    expect(isBlockedAddress('93.184.216.34')).toBe(false);
  });

  it('blocks private, loopback, link-local and metadata addresses', () => {
    expect(isBlockedAddress('127.0.0.1')).toBe(true);
    expect(isBlockedAddress('10.0.0.5')).toBe(true);
    expect(isBlockedAddress('172.16.4.4')).toBe(true);
    expect(isBlockedAddress('192.168.1.1')).toBe(true);
    expect(isBlockedAddress('169.254.169.254')).toBe(true); // cloud metadata
    expect(isBlockedAddress('0.0.0.0')).toBe(true);
    expect(isBlockedAddress('100.64.0.1')).toBe(true); // CGNAT
  });

  it('blocks IPv6 loopback/link-local/ULA and IPv4-mapped private', () => {
    expect(isBlockedAddress('::1')).toBe(true);
    expect(isBlockedAddress('fe80::1')).toBe(true);
    expect(isBlockedAddress('fc00::1')).toBe(true);
    expect(isBlockedAddress('::ffff:127.0.0.1')).toBe(true);
  });

  it('treats invalid input as blocked', () => {
    expect(isBlockedAddress('not-an-ip')).toBe(true);
  });
});

describe('validateAndResolveUrl', () => {
  beforeEach(() => dnsLookup.mockReset());

  it('accepts a normal public http URL', async () => {
    publicIp();
    const r = await validateAndResolveUrl('https://example.com');
    expect(r.hostname).toBe('example.com');
    expect(r.folderName).toBe('example.com');
    expect(r.url).toMatch(/^https:\/\/example\.com/);
  });

  it('prefixes a bare hostname with http://', async () => {
    publicIp();
    const r = await validateAndResolveUrl('example.com');
    expect(r.url).toMatch(/^http:\/\/example\.com/);
  });

  it('rejects non-http(s) protocols', async () => {
    await expect(validateAndResolveUrl('ftp://example.com')).rejects.toBeInstanceOf(
      ValidationError
    );
    await expect(validateAndResolveUrl('file:///etc/passwd')).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('rejects empty input', async () => {
    await expect(validateAndResolveUrl('   ')).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects embedded credentials', async () => {
    publicIp();
    await expect(validateAndResolveUrl('http://user:pass@example.com')).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('rejects an IP literal that is private (no DNS needed)', async () => {
    await expect(validateAndResolveUrl('http://127.0.0.1/')).rejects.toBeInstanceOf(
      ValidationError
    );
    expect(dnsLookup).not.toHaveBeenCalled();
  });

  it('rejects a hostname that resolves to a private address', async () => {
    dnsLookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);
    await expect(validateAndResolveUrl('http://internal.example.com')).rejects.toBeInstanceOf(
      ValidationError
    );
  });
});
