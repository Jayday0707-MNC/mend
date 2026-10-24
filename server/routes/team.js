const express = require('express');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

// Everyone in my community
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, role, created_at FROM users WHERE community_id = $1 ORDER BY created_at',
      [req.user.communityId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Promote a resident to moderator, or demote back
router.patch('/:id/role', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  const { role } = req.body;
  if (!['resident', 'moderator'].includes(role)) {
    return res.status(400).json({ error: 'role must be resident or moderator' });
  }
  if (id === req.user.id) {
    return res.status(400).json({ error: 'You cannot change your own role' });
  }

  try {
    // Scoped to my community, and admins can never be changed here
    const result = await pool.query(
      `UPDATE users SET role = $1
       WHERE id = $2 AND community_id = $3 AND role <> 'admin'
       RETURNING id, email, role`,
      [role, id, req.user.communityId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Member not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;