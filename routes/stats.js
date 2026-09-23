// routes/stats.js
const router = require('express').Router();
const { Tickets, Accounts, Audit } = require('../db/repositories');
const { requireAuth } = require('../middleware/auth');
const { isITStaff, requireITStaff, requireAdmin } = require('../middleware/rbac');
const { isSameMonth, computeLeaderboard } = require('../utils/leaderboard');

router.use(requireAuth);

async function nameOf(id) {
  if (!id) return null;
  const a = await Accounts.findById(id);
  return a ? a.name : null;
}

router.get('/dashboard', async (req, res, next) => {
  try {
    const all = await Tickets.all();
    const rows = isITStaff(req.user) ? all : all.filter(t => t.requesterId === req.user.id);
    const audit = (await Audit.all()).slice(0, 8);
    res.json({
      open: rows.filter(t => t.status === 'Open').length,
      inProgress: rows.filter(t => t.status === 'In Progress').length,
      urgentOpen: rows.filter(t => ['Open', 'In Progress'].includes(t.status) && ['Critical', 'High'].includes(t.priority)).length,
      resolvedThisMonth: rows.filter(t => t.resolvedAt && isSameMonth(t.resolvedAt)).length,
      recentActivity: await Promise.all(audit.map(async a => ({ time: a.time, actor: await nameOf(a.actorId), action: a.action, ticketId: a.ticketId })))
    });
  } catch (err) { next(err); }
});

router.get('/leaderboard', requireITStaff, async (req, res, next) => {
  try {
    const all = await Tickets.all();
    const closedThisMonth = all.filter(t => t.resolvedAt && isSameMonth(t.resolvedAt));
    res.json({
      totalOpen: all.filter(t => t.status === 'Open').length,
      totalResolved: all.filter(t => ['Resolved', 'Closed'].includes(t.status)).length,
      urgentOpen: all.filter(t => ['Open', 'In Progress'].includes(t.status) && ['Critical', 'High'].includes(t.priority)).length,
      closedThisMonth: closedThisMonth.length,
      leaderboard: computeLeaderboard(all, await Accounts.itStaff())
    });
  } catch (err) { next(err); }
});

router.get('/audit', requireAdmin, async (req, res, next) => {
  try {
    const audit = await Audit.all();
    res.json({ audit: await Promise.all(audit.map(async a => ({ time: a.time, actor: await nameOf(a.actorId), action: a.action, ticketId: a.ticketId }))) });
  } catch (err) { next(err); }
});

module.exports = router;
