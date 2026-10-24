const express = require('express');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const CATEGORIES = ['water', 'power', 'pothole', 'other'];
const STATUSES = ['reported', 'confirmed', 'in_progress', 'resolved'];
const CONFIRM_AT = 2; // confirmations needed (the reporter counts as the first voice, so 3 people in total)
const NEARBY_METRES = 250;

const parseId = (v) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
};

// $1 = community id, $2 = current user id
const SELECT_REPORT = `
  SELECT r.id, r.category, r.title, r.description, r.lat, r.lng, r.status,
         r.created_at, r.resolved_at,
         (r.created_by = $2) AS mine,
         EXISTS (SELECT 1 FROM confirmations c WHERE c.report_id = r.id AND c.user_id = $2) AS confirmed_by_me,
         (SELECT COUNT(*) FROM confirmations c WHERE c.report_id = r.id)::int AS confirmations
  FROM reports r`;

// List reports in my community (?category= and ?status=)
router.get('/', async (req, res) => {
  const { category, status } = req.query;
  if (category && !CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` });
  }
  if (status && !STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` });
  }

  const params = [req.user.communityId, req.user.id];
  let sql = `${SELECT_REPORT} WHERE r.community_id = $1`;
  if (category) {
    params.push(category);
    sql += ` AND r.category = $${params.length}`;
  }
  if (status) {
    params.push(status);
    sql += ` AND r.status = $${params.length}`;
  }
  sql += ' ORDER BY r.created_at DESC LIMIT 200';

  try {
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Open reports of the same category close to a point (the duplicate check).
// This must stay ABOVE '/:id' so "nearby" is not read as an id.
router.get('/nearby', async (req, res) => {
  const { category } = req.query;
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!CATEGORIES.includes(category) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'category, lat and lng are required' });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM (
         SELECT r.id, r.category, r.title, r.status, r.lat, r.lng,
                (r.created_by = $2) AS mine,
                EXISTS (SELECT 1 FROM confirmations c WHERE c.report_id = r.id AND c.user_id = $2) AS confirmed_by_me,
                (SELECT COUNT(*) FROM confirmations c WHERE c.report_id = r.id)::int AS confirmations,
                6371000 * 2 * asin(sqrt(
                  power(sin(radians(r.lat - $4::float8) / 2), 2) +
                  cos(radians($4::float8)) * cos(radians(r.lat)) *
                  power(sin(radians(r.lng - $5::float8) / 2), 2)
                )) AS distance_m
         FROM reports r
         WHERE r.community_id = $1 AND r.category = $3 AND r.status <> 'resolved'
           AND r.lat BETWEEN $4::float8 - 0.004 AND $4::float8 + 0.004
           AND r.lng BETWEEN $5::float8 - 0.004 AND $5::float8 + 0.004
       ) near
       WHERE distance_m <= $6::float8
       ORDER BY distance_m
       LIMIT 5`,
      [req.user.communityId, req.user.id, category, lat, lng, NEARBY_METRES]
    );
    res.json(result.rows.map((r) => ({ ...r, distance_m: Math.round(r.distance_m) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a report
router.post('/', async (req, res) => {
  const { category, title, description, lat, lng } = req.body;

  if (!CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` });
  }
  if (!title || !title.trim() || title.length > 120) {
    return res.status(400).json({ error: 'title is required (max 120 characters)' });
  }
  if (description && description.length > 1000) {
    return res.status(400).json({ error: 'description is too long (max 1000 characters)' });
  }
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) {
    return res.status(400).json({ error: 'lat and lng must be valid coordinates' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO reports (community_id, category, title, description, lat, lng, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, category, title, description, lat, lng, status, created_at`,
      [req.user.communityId, category, title.trim(), description?.trim() || null, la, ln, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// One report, with its status timeline
router.get('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Invalid id' });

  try {
    const report = await pool.query(
      `${SELECT_REPORT} WHERE r.community_id = $1 AND r.id = $3`,
      [req.user.communityId, req.user.id, id]
    );
    if (!report.rows[0]) return res.status(404).json({ error: 'Report not found' });

    const updates = await pool.query(
      'SELECT new_status, note, created_at FROM updates WHERE report_id = $1 ORDER BY created_at',
      [id]
    );
    res.json({ ...report.rows[0], updates: updates.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// "I have this too"
router.post('/:id/confirm', async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Invalid id' });

  try {
    const found = await pool.query(
      'SELECT id, created_by, status FROM reports WHERE id = $1 AND community_id = $2',
      [id, req.user.communityId]
    );
    const report = found.rows[0];
    if (!report) return res.status(404).json({ error: 'Report not found' });
    if (report.created_by === req.user.id) {
      return res.status(400).json({ error: 'You reported this one, so it already counts' });
    }
    if (report.status === 'resolved') {
      return res.status(400).json({ error: 'This problem is already marked as resolved' });
    }

    await pool.query(
      'INSERT INTO confirmations (report_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [id, req.user.id]
    );
    const count = await pool.query(
      'SELECT COUNT(*)::int AS n FROM confirmations WHERE report_id = $1',
      [id]
    );
    const n = count.rows[0].n;

    // Enough people back it: move it from "reported" to "confirmed"
    if (n >= CONFIRM_AT && report.status === 'reported') {
      const moved = await pool.query(
        `UPDATE reports SET status = 'confirmed' WHERE id = $1 AND status = 'reported' RETURNING id`,
        [id]
      );
      if (moved.rows[0]) {
        await pool.query(
          `INSERT INTO updates (report_id, user_id, new_status, note) VALUES ($1, $2, 'confirmed', $3)`,
          [id, req.user.id, `Confirmed by ${n + 1} residents`]
        );
      }
    }
    res.json({ confirmations: n });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Take my confirmation back
router.delete('/:id/confirm', async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Invalid id' });

  try {
    const found = await pool.query(
      'SELECT id FROM reports WHERE id = $1 AND community_id = $2',
      [id, req.user.communityId]
    );
    if (!found.rows[0]) return res.status(404).json({ error: 'Report not found' });

    await pool.query('DELETE FROM confirmations WHERE report_id = $1 AND user_id = $2', [id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Move a report along (moderators and admins only)
router.patch('/:id/status', requireRole('moderator', 'admin'), async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Invalid id' });

  const { status, note } = req.body;
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` });
  }
  if (note && note.length > 500) {
    return res.status(400).json({ error: 'note is too long (max 500 characters)' });
  }

  try {
    const found = await pool.query(
      'SELECT id, status FROM reports WHERE id = $1 AND community_id = $2',
      [id, req.user.communityId]
    );
    if (!found.rows[0]) return res.status(404).json({ error: 'Report not found' });
    if (found.rows[0].status === status) {
      return res.status(400).json({ error: 'The report is already at that status' });
    }

    await pool.query(
      `UPDATE reports
       SET status = $1::text,
           resolved_at = CASE WHEN $1::text = 'resolved' THEN now() ELSE NULL END
       WHERE id = $2 AND community_id = $3`,
      [status, id, req.user.communityId]
    );
    await pool.query(
      'INSERT INTO updates (report_id, user_id, new_status, note) VALUES ($1, $2, $3, $4)',
      [id, req.user.id, status, note?.trim() || null]
    );
    res.json({ status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;