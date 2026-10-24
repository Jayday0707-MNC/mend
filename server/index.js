require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const { rateLimit } = require('./middleware/rateLimit');

const app = express();
app.set('trust proxy', 1); // needed so rate limits see the real visitor IP once deployed

const allowed = process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',') : true;
app.use(cors({ origin: allowed }));
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT now()');
    res.json({ status: 'ok', time: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'database error' });
  }
});

// Slow down password guessing on sign-in and sign-up
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 });
app.use(['/api/auth/login', '/api/auth/register', '/api/auth/register-community'], authLimiter);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/communities', require('./routes/communities'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/team', require('./routes/team'));
app.use('/api/public', rateLimit({ windowMs: 60 * 1000, max: 120 }), require('./routes/public'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));