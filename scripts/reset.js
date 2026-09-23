// scripts/reset.js — wipes and reseeds the database. Run with: npm run seed:reset
require('dotenv').config();
const pool = require('../db/pool');

(async () => {
  await pool.query('TRUNCATE accounts, tickets, comments, audit_log RESTART IDENTITY CASCADE');
  await pool.query(`UPDATE counters SET value = 1043 WHERE name = 'ticket_seq'`);
  const { ensureReady } = require('../db/init');
  // ensureReady's seed check runs against an empty accounts table, so this reseeds it.
  await ensureReady();
  console.log('Database reset and reseeded.');
  process.exit(0);
})().catch((err) => { console.error(err); process.exit(1); });
