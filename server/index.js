require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
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

app.use('/api/auth', require('./routes/auth'));
app.use('/api/communities', require('./routes/communities'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));