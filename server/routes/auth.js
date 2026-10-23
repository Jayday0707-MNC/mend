const express = require('express');
const bcrypt = require('bcrypt'); // use 'bcryptjs' if that is what you installed
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function makeToken(user) {
  return jwt.sign(
    { id: user.id, communityId: user.community_id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

// Start a new community. The person who creates it becomes its admin.
router.post('/register-community', async (req, res) => {
  const { communityName, email, password, centerLat, centerLng } = req.body;
  if (!communityName || !email || !password) {
    return res.status(400).json({ error: 'communityName, email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Find a free slug, adding a short random suffix if it is taken
    let slug = slugify(communityName) || 'community';
    const taken = await client.query('SELECT 1 FROM communities WHERE slug = $1', [slug]);
    if (taken.rowCount > 0) slug += '-' + crypto.randomBytes(2).toString('hex');

    const community = await client.query(
      `INSERT INTO communities (name, slug, center_lat, center_lng)
       VALUES ($1, $2, $3, $4) RETURNING id, name, slug`,
      [communityName, slug, centerLat ?? null, centerLng ?? null]
    );

    const hash = await bcrypt.hash(password, 10);
    const user = await client.query(
      `INSERT INTO users (community_id, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin') RETURNING id, community_id, email, role`,
      [community.rows[0].id, email.toLowerCase(), hash]
    );

    await client.query('COMMIT');
    res.status(201).json({ token: makeToken(user.rows[0]), user: user.rows[0], community: community.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That email is already registered' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// Join an existing community as a resident
router.post('/register', async (req, res) => {
  const { communitySlug, email, password } = req.body;
  if (!communitySlug || !email || !password) {
    return res.status(400).json({ error: 'communitySlug, email and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const community = await pool.query('SELECT id FROM communities WHERE slug = $1', [communitySlug]);
    if (!community.rows[0]) return res.status(404).json({ error: 'Community not found' });

    const hash = await bcrypt.hash(password, 10);
    const user = await pool.query(
      `INSERT INTO users (community_id, email, password_hash, role)
       VALUES ($1, $2, $3, 'resident') RETURNING id, community_id, email, role`,
      [community.rows[0].id, email.toLowerCase(), hash]
    );
    res.status(201).json({ token: makeToken(user.rows[0]), user: user.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That email is already registered' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const result = await pool.query(
      'SELECT id, community_id, email, role, password_hash FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    const user = result.rows[0];
    const ok = user && (await bcrypt.compare(password, user.password_hash));
    if (!ok) return res.status(401).json({ error: 'Wrong email or password' });

    delete user.password_hash;
    res.json({ token: makeToken(user), user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.role, c.id AS community_id, c.name AS community_name, c.slug AS community_slug
       FROM users u JOIN communities c ON c.id = u.community_id
       WHERE u.id = $1 AND u.community_id = $2`,
      [req.user.id, req.user.communityId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;