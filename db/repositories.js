// db/repositories.js
const bcrypt = require('bcryptjs');
const pool = require('./pool');

const Accounts = {
  all: async () => (await pool.query('SELECT * FROM accounts ORDER BY id')).rows,
  findById: async (id) => (await pool.query('SELECT * FROM accounts WHERE id=$1', [id])).rows[0] || null,
  findByEmail: async (email) => (await pool.query('SELECT * FROM accounts WHERE lower(email)=lower($1)', [email])).rows[0] || null,
  create: async ({ name, email, password, department }) => {
    const hash = bcrypt.hashSync(password, 8);
    const { rows } = await pool.query(
      `INSERT INTO accounts (name,email,password_hash,department,role,status) VALUES ($1,$2,$3,$4,'employee','pending') RETURNING *`,
      [name, email, hash, department]
    );
    return rows[0];
  },
  setStatus: async (id, status, department) => {
    const { rows } = await pool.query(
      `UPDATE accounts SET status=$2, department=COALESCE($3, department) WHERE id=$1 RETURNING *`,
      [id, status, department || null]
    );
    return rows[0] || null;
  },
  verifyPassword: (account, password) => bcrypt.compareSync(password, account.password_hash),
  itStaff: async () => (await pool.query(`SELECT * FROM accounts WHERE department='IT' AND status='approved'`)).rows
};

function rowToTicket(row, comments) {
  return {
    id: row.id, subject: row.subject, description: row.description, priority: row.priority, status: row.status,
    requesterId: row.requester_id, department: row.department, assigneeId: row.assignee_id, category: row.category,
    createdAt: new Date(row.created_at).getTime(), resolvedAt: row.resolved_at ? new Date(row.resolved_at).getTime() : null,
    comments: comments || []
  };
}

const Tickets = {
  all: async () => {
    const { rows } = await pool.query('SELECT * FROM tickets ORDER BY created_at DESC');
    return rows.map(r => rowToTicket(r));
  },
  findById: async (id) => {
    const { rows } = await pool.query('SELECT * FROM tickets WHERE id=$1', [id]);
    if (!rows[0]) return null;
    const { rows: comments } = await pool.query('SELECT * FROM comments WHERE ticket_id=$1 ORDER BY time', [id]);
    return rowToTicket(rows[0], comments.map(c => ({ authorId: c.author_id, body: c.body, time: new Date(c.time).getTime() })));
  },
  create: async ({ subject, description, priority, category, requesterId, department }) => {
    const { rows: seqRows } = await pool.query(
      `UPDATE counters SET value = value + 1 WHERE name='ticket_seq' RETURNING value`
    );
    const id = `TK-${seqRows[0].value}`;
    const { rows } = await pool.query(
      `INSERT INTO tickets (id,subject,description,priority,status,requester_id,department,category)
       VALUES ($1,$2,$3,$4,'Open',$5,$6,$7) RETURNING *`,
      [id, subject, description || 'No additional details provided.', priority, requesterId, department, category || 'General']
    );
    return rowToTicket(rows[0]);
  },
  update: async (id, changes) => {
    const sets = [];
    const vals = [id];
    let i = 2;
    if (changes.status !== undefined) { sets.push(`status=$${i++}`); vals.push(changes.status); }
    if (changes.assigneeId !== undefined) { sets.push(`assignee_id=$${i++}`); vals.push(changes.assigneeId); }
    if (changes.resolvedAt !== undefined) { sets.push(`resolved_at=$${i++}`); vals.push(changes.resolvedAt ? new Date(changes.resolvedAt) : null); }
    if (!sets.length) return Tickets.findById(id);
    const { rows } = await pool.query(`UPDATE tickets SET ${sets.join(', ')} WHERE id=$1 RETURNING *`, vals);
    if (!rows[0]) return null;
    return Tickets.findById(id);
  },
  addComment: async (id, { authorId, body }) => {
    await pool.query('INSERT INTO comments (ticket_id, author_id, body) VALUES ($1,$2,$3)', [id, authorId, body]);
    return Tickets.findById(id);
  }
};

const Audit = {
  all: async () => {
    const { rows } = await pool.query('SELECT * FROM audit_log ORDER BY time DESC');
    return rows.map(r => ({ id: r.id, time: new Date(r.time).getTime(), actorId: r.actor_id, action: r.action, ticketId: r.ticket_id }));
  },
  log: async ({ actorId, action, ticketId }) => {
    await pool.query('INSERT INTO audit_log (actor_id, action, ticket_id) VALUES ($1,$2,$3)', [actorId, action, ticketId]);
  }
};

module.exports = { Accounts, Tickets, Audit };
