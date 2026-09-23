// api/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ensureReady } = require('../db/init');

const { router: authRoutes } = require('../routes/auth');
const accountRoutes = require('../routes/accounts');
const ticketRoutes = require('../routes/tickets');
const statsRoutes = require('../routes/stats');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(require('path').join(__dirname, '..', 'public')));

// Make sure tables exist + demo data is seeded before handling any request.
// Cached in a module-level promise so it only really runs once per cold start.
app.use(async (req, res, next) => {
  try { await ensureReady(); next(); } catch (err) { next(err); }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: Date.now() }));
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/stats', statsRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`TicketFlow API listening on http://localhost:${PORT}`));
}

module.exports = app;
