// db/init.js
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('./pool');

let readyPromise = null;

async function seedIfEmpty() {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM accounts');
  if (rows[0].n > 0) return;

  const now = Date.now();
  const day = 86400000;
  const hash = (pw) => bcrypt.hashSync(pw, 8);

  const accInsert = `INSERT INTO accounts (name,email,password_hash,department,role,status,created_at) VALUES ($1,$2,$3,$4,$5,$6,to_timestamp($7/1000.0)) RETURNING id`;
  const accounts = [
    ['Moe Satra', 'admin@demo.io', hash('admin123'), 'IT', 'admin', 'approved', now - 2 * day],
    ['Sarah Kim', 'sarah@demo.io', hash('demo123'), 'IT', 'employee', 'approved', now - 3 * day],
    ['Dan Reyes', 'dan@demo.io', hash('demo123'), 'IT', 'employee', 'approved', now - 3 * day],
    ['Alex Doyle', 'alex@demo.io', hash('demo123'), 'Marketing', 'employee', 'approved', now - 4 * day],
    ['Priya Nair', 'priya@demo.io', hash('demo123'), 'Finance', 'employee', 'pending', now - 1 * day],
    ['Jordan Lee', 'jordan@demo.io', hash('demo123'), 'Sales', 'employee', 'pending', now - 0.5 * day]
  ];
  const ids = {};
  for (const a of accounts) {
    const { rows } = await pool.query(accInsert, a);
    ids[a[1]] = rows[0].id; // keyed by email
  }

  const tkInsert = `INSERT INTO tickets (id,subject,description,priority,status,requester_id,department,assignee_id,category,created_at,resolved_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,to_timestamp($10/1000.0), $11)`;
  const mkTicket = (id, subject, desc, priority, status, requesterEmail, dept, assigneeEmail, hoursAgo, category) => {
    const createdAt = now - hoursAgo * 3600000;
    const resolvedAt = (status === 'Resolved' || status === 'Closed')
      ? new Date(createdAt + Math.max(1, hoursAgo * 0.4) * 3600000) : null;
    return [id, subject, desc, priority, status, ids[requesterEmail], dept, assigneeEmail ? ids[assigneeEmail] : null, category, createdAt, resolvedAt];
  };
  const tickets = [
    mkTicket('TK-1042', 'VPN drops every 10 minutes on campus wifi', "Started after this morning's Windows update.", 'High', 'In Progress', 'alex@demo.io', 'Marketing', 'sarah@demo.io', 3, 'General'),
    mkTicket('TK-1041', 'Need MFA reset — lost phone', 'Lost my phone yesterday, cannot approve MFA prompts.', 'Critical', 'Open', 'alex@demo.io', 'Marketing', null, 1, 'Access Request'),
    mkTicket('TK-1039', 'AV setup for board room Friday', 'Need mic + projector configured for 10am meeting.', 'Low', 'Open', 'priya@demo.io', 'Finance', null, 20, 'AV Setup'),
    mkTicket('TK-1035', 'Laptop stuck on BitLocker recovery screen', 'Boots straight to recovery key prompt after patch cycle.', 'Critical', 'Resolved', 'alex@demo.io', 'Marketing', 'dan@demo.io', 30, 'Hardware'),
    mkTicket('TK-1030', 'New hire — accounts not provisioned', 'Start date Monday, no AD/M365 account yet.', 'High', 'Resolved', 'jordan@demo.io', 'Sales', 'sarah@demo.io', 50, 'Access Request'),
    mkTicket('TK-1022', 'New monitor request for finance desk', 'Second monitor for new analyst.', 'Medium', 'Closed', 'priya@demo.io', 'Finance', 'sarah@demo.io', 96, 'Purchase Request'),
    mkTicket('TK-1018', 'Staff ID card replacement', "Card demagnetized, can't badge into building.", 'Medium', 'Closed', 'jordan@demo.io', 'Sales', 'dan@demo.io', 150, 'Staff ID Card'),
    mkTicket('TK-1015', 'Software license for design tool', 'Need Adobe CC seat for new marketing hire.', 'Low', 'Resolved', 'alex@demo.io', 'Marketing', 'dan@demo.io', 200, 'Software')
  ];
  for (const t of tickets) await pool.query(tkInsert, t);

  await pool.query(
    `INSERT INTO audit_log (time, actor_id, action, ticket_id) VALUES (to_timestamp($1/1000.0), $2, $3, $4)`,
    [now - 3600000, ids['sarah@demo.io'], 'updated status on', 'TK-1042']
  );

  console.log('Seeded database with demo accounts and tickets.');
}

async function ensureReady() {
  if (!readyPromise) {
    readyPromise = (async () => {
      const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
      await pool.query(schema);
      await seedIfEmpty();
    })();
  }
  return readyPromise;
}

module.exports = { ensureReady };
