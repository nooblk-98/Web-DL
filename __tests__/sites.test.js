'use strict';

const path = require('path');
const config = require('../config');
const { safeZipPath } = require('../lib/sites');

describe('safeZipPath', () => {
  it('resolves a valid zip name inside SITES_DIR', () => {
    expect(safeZipPath('example.com.zip')).toBe(path.join(config.SITES_DIR, 'example.com.zip'));
    expect(safeZipPath('my-site_1:8080.zip')).toBe(
      path.join(config.SITES_DIR, 'my-site_1:8080.zip')
    );
  });

  it('rejects path traversal and nested paths', () => {
    expect(safeZipPath('../etc/passwd')).toBeNull();
    expect(safeZipPath('../../secret.zip')).toBeNull();
    expect(safeZipPath('sub/dir.zip')).toBeNull();
    expect(safeZipPath('/abs/path.zip')).toBeNull();
  });

  it('rejects non-zip and malformed names', () => {
    expect(safeZipPath('notes.txt')).toBeNull();
    expect(safeZipPath('noextension')).toBeNull();
    expect(safeZipPath('')).toBeNull();
    expect(safeZipPath(null)).toBeNull();
  });
});
