const jwt = require('jsonwebtoken');
const pool = require('../db');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not logged in' });

  try {
    const p = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: p.id, communityId: p.communityId, role: p.role };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Reads the CURRENT role from the database, so promotions and demotions
// take effect immediately instead of waiting for the token to expire.
function requireRole(...roles) {
  return async (req, res, next) => {
    try {
      const result = await pool.query(
        'SELECT role FROM users WHERE id = $1 AND community_id = $2',
        [req.user.id, req.user.communityId]
      );
      const role = result.rows[0]?.role;
      if (!role || !roles.includes(role)) {
        return res.status(403).json({ error: 'You do not have permission to do that' });
      }
      req.user.role = role;
      next();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  };
}

module.exports = { requireAuth, requireRole };