const express = require('express');
const pool = require('../db');

const router = express.Router();
const CATEGORIES = ['water', 'power', 'pothole', 'other'];

async function findCommunity(slug) {
  const result = await pool.query(
    'SELECT id, name, slug, center_lat, center_lng FROM communities WHERE slug = $1',
    [slug]
  );
  return result.rows[0] || null;
}

// Only safe fields: no description, no reporter, and coordinates rounded to ~100 m.
const PUBLIC_SELECT = `
  SELECT r.id, r.category, r.title, r.status,
         ROUND(r.lat::numeric, 3)::float8 AS lat,
         ROUND(r.lng::numeric, 3)::float8 AS lng,
         r.created_at, r.resolved_at,
         (SELECT COUNT(*) FROM confirmations c WHERE c.report_id = r.id)::int AS confirmations
  FROM reports r`;

// Resolved reports stay visible for 30 days, then drop off the public page.
const VISIBLE = `(r.status <> 'resolved' OR r.resolved_at > now() - interval '30 days')`;

router.get('/:slug/summary', async (req, res) => {
  try {
    const community = await findCommunity(req.params.slug);
    if (!community) return res.status(404).json({ error: 'Community not found' });

    const [byStatus, recent, avg] = await Promise.all([
      pool.query('SELECT status, COUNT(*)::int AS n FROM reports WHERE community_id = $1 GROUP BY status', [community.id]),
      pool.query(
        `SELECT COUNT(*)::int AS n FROM reports
         WHERE community_id = $1 AND status = 'resolved' AND resolved_at > now() - interval '30 days'`,
        [community.id]
      ),
      pool.query(
        `SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))) / 3600 AS hours FROM reports
         WHERE community_id = $1 AND status = 'resolved' AND resolved_at > now() - interval '90 days'`,
        [community.id]
      ),
    ]);

    const counts = { reported: 0, confirmed: 0, in_progress: 0, resolved: 0 };
    for (const row of byStatus.rows) counts[row.status] = row.n;
    const hours = avg.rows[0].hours;

    res.json({
      community: {
        name: community.name,
        slug: community.slug,
        center_lat: community.center_lat,
        center_lng: community.center_lng,
      },
      counts,
      resolvedLast30: recent.rows[0].n,
      avgResolveHours: hours === null ? null : Number(hours),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:slug/reports', async (req, res) => {
  const { category } = req.query;
  if (category && !CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${CATEGORIES.join(', ')}` });
  }

  try {
    const community = await findCommunity(req.params.slug);
    if (!community) return res.status(404).json({ error: 'Community not found' });

    const params = [community.id];
    let sql = `${PUBLIC_SELECT} WHERE r.community_id = $1 AND ${VISIBLE}`;
    if (category) {
      params.push(category);
      sql += ` AND r.category = $${params.length}`;
    }
    sql += ' ORDER BY r.created_at DESC LIMIT 200';

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:slug/reports/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const community = await findCommunity(req.params.slug);
    if (!community) return res.status(404).json({ error: 'Community not found' });

    const report = await pool.query(
      `${PUBLIC_SELECT} WHERE r.community_id = $1 AND r.id = $2 AND ${VISIBLE}`,
      [community.id, id]
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

module.exports = router;