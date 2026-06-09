'use strict';

const { buildWgetArgs, parseExtensions } = require('../lib/wgetArgs');

const URL = 'https://example.com/';

describe('parseExtensions', () => {
  it('normalises and validates extension lists, dropping bad tokens', () => {
    expect(parseExtensions('html, css ,PNG')).toEqual(['html', 'css', 'png']);
    expect(parseExtensions('.jpg,.gif')).toEqual(['jpg', 'gif']);
    expect(parseExtensions('exe!,ok,toolongextension')).toEqual(['ok']);
    expect(parseExtensions('')).toEqual([]);
  });
});

describe('buildWgetArgs', () => {
  it('always ends with the -- sentinel immediately before the URL', () => {
    const args = buildWgetArgs(URL);
    expect(args[args.length - 2]).toBe('--');
    expect(args[args.length - 1]).toBe(URL);
  });

  it('includes the always-on base flags and --no-parent by default', () => {
    const args = buildWgetArgs(URL);
    expect(args).toEqual(expect.arrayContaining(['--mirror', '--convert-links', '--no-parent']));
  });

  it('clamps crawl depth into [0, 10]', () => {
    expect(buildWgetArgs(URL, { depth: 999 })).toEqual(expect.arrayContaining(['-l', '10']));
    expect(buildWgetArgs(URL, { depth: -5 })).toEqual(expect.arrayContaining(['-l', '0']));
  });

  it('coerces a malicious depth string to a safe integer (no raw flags)', () => {
    const args = buildWgetArgs(URL, { depth: '5; rm -rf /' });
    expect(args).toEqual(expect.arrayContaining(['-l', '5']));
    expect(args).not.toEqual(expect.arrayContaining(['rm']));
  });

  it('omits --page-requisites when disabled', () => {
    expect(buildWgetArgs(URL, { pageRequisites: false })).not.toContain('--page-requisites');
    expect(buildWgetArgs(URL, { pageRequisites: true })).toContain('--page-requisites');
  });

  it('spans hosts only when followExternal is set', () => {
    const ext = buildWgetArgs(URL, { followExternal: true });
    expect(ext).toContain('--span-hosts');
    expect(ext).not.toContain('--no-parent');
  });

  it('maps include/exclude extensions to -A/-R', () => {
    const args = buildWgetArgs(URL, { include: 'html,css', exclude: 'zip' });
    const a = args.indexOf('-A');
    const r = args.indexOf('-R');
    expect(args[a + 1]).toBe('html,css');
    expect(args[r + 1]).toBe('zip');
  });

  it('clamps the size quota and formats it in megabytes', () => {
    const args = buildWgetArgs(URL, { maxSizeMb: 999999 });
    const q = args.indexOf('-Q');
    expect(args[q + 1]).toBe('2048m');
  });
});
