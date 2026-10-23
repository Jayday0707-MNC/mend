const express = require('express');
const pool = require('../db');

const router = express.Router();

// List communities (public: only safe fields)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT name, slug, center_lat, center_lng FROM communities ORDER BY name'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// One community by slug (public)
router.get('/:slug', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT name, slug, center_lat, center_lng FROM communities WHERE slug = $1',
      [req.params.slug]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Community not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;