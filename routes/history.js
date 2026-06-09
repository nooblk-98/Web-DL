'use strict';

/**
 * Download history API.
 *
 *   GET    /api/history        -> list generated zips (name, size, modified)
 *   DELETE /api/history/:name  -> delete one zip (traversal-guarded)
 *
 * Re-downloading is handled by express.static serving /sites/<name>.zip.
 */

const express = require('express');
const { listZips, deleteZip } = require('../lib/sites');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const files = await listZips();
    res.json(files.map((f) => ({ ...f, url: `/sites/${encodeURIComponent(f.name)}` })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:name', async (req, res) => {
  const ok = await deleteZip(req.params.name);
  if (!ok) return res.status(400).json({ error: 'Invalid or unknown file.' });
  res.json({ deleted: req.params.name });
});

module.exports = router;
