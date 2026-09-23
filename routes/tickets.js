// routes/tickets.js
const router = require('express').Router();
const { Tickets, Accounts, Audit } = require('../db/repositories');
const { requireAuth } = require('../middleware/auth');
const { isITStaff } = require('../middleware/rbac');

async function nameOf(id) {
  if (!id) return null;
  const a = await Accounts.findById(id);
  return a ? a.name : null;
}

async function serializeTicket(t) {
  return {
    id: t.id, subject: t.subject, description: t.description, priority: t.priority, status: t.status,
    department: t.department, category: t.category, createdAt: t.createdAt, resolvedAt: t.resolvedAt,
    requester: await nameOf(t.requesterId), assignee: t.assigneeId ? await nameOf(t.assigneeId) : null,
    comments: await Promise.all(t.comments.map(async c => ({ author: await nameOf(c.authorId), body: c.body, time: c.time })))
  };
}

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    let rows = isITStaff(req.user) ? await Tickets.all() : (await Tickets.all()).filter(t => t.requesterId === req.user.id);
    const { status, priority, search } = req.query;
    if (status) rows = rows.filter(t => t.status === status);
    if (priority) rows = rows.filter(t => t.priority === priority);
    if (search) rows = rows.filter(t => t.subject.toLowerCase().includes(String(search).toLowerCase()));
    res.json({ tickets: await Promise.all(rows.map(serializeTicket)) });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { subject, description, priority, category } = req.body || {};
    if (!subject || !priority) return res.status(400).json({ error: 'subject and priority are required' });
    const ticket = await Tickets.create({ subject, description, priority, category, requesterId: req.user.id, department: req.user.department });
    await Audit.log({ actorId: req.user.id, action: 'created', ticketId: ticket.id });
    res.status(201).json({ ticket: await serializeTicket(ticket) });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const t = await Tickets.findById(req.params.id);
    if (!t || !(isITStaff(req.user) || t.requesterId === req.user.id)) return res.status(404).json({ error: 'Ticket not found' });
    res.json({ ticket: await serializeTicket(t) });
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    if (!isITStaff(req.user)) return res.status(403).json({ error: 'IT department access required' });
    const t = await Tickets.findById(req.params.id);
    if (!t) return res.status(404).json({ error: 'Ticket not found' });

    const changes = {};
    const logParts = [];
    const { status, assigneeName } = req.body || {};

    if (status && status !== t.status) {
      changes.status = status;
      changes.resolvedAt = (status === 'Resolved' || status === 'Closed') ? (t.resolvedAt || Date.now()) : null;
      logParts.push(`status → ${status}`);
    }
    if (assigneeName !== undefined) {
      const agent = assigneeName ? (await Accounts.itStaff()).find(a => a.name === assigneeName) : null;
      if (assigneeName && !agent) return res.status(400).json({ error: 'Unknown assignee' });
      const newId = agent ? agent.id : null;
      if (newId !== t.assigneeId) { changes.assigneeId = newId; logParts.push(`assigned → ${assigneeName || 'unassigned'}`); }
    }

    const updated = await Tickets.update(t.id, changes);
    if (logParts.length) await Audit.log({ actorId: req.user.id, action: `${logParts.join(', ')} on`, ticketId: t.id });
    res.json({ ticket: await serializeTicket(updated) });
  } catch (err) { next(err); }
});

router.post('/:id/comments', async (req, res, next) => {
  try {
    const t = await Tickets.findById(req.params.id);
    if (!t || !(isITStaff(req.user) || t.requesterId === req.user.id)) return res.status(404).json({ error: 'Ticket not found' });
    const { body } = req.body || {};
    if (!body || !body.trim()) return res.status(400).json({ error: 'Comment body is required' });
    const updated = await Tickets.addComment(t.id, { authorId: req.user.id, body: body.trim() });
    await Audit.log({ actorId: req.user.id, action: 'commented on', ticketId: t.id });
    res.status(201).json({ ticket: await serializeTicket(updated) });
  } catch (err) { next(err); }
});

module.exports = router;
