// routes/accounts.js
const router = require('express').Router();
const { Accounts, Audit } = require('../db/repositories');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');
const { publicAccount } = require('./auth');

router.use(requireAuth, requireAdmin);

router.get('/pending', async (req, res, next) => {
  try {
    const all = await Accounts.all();
    res.json({ pending: all.filter(a => a.status === 'pending').map(publicAccount) });
  } catch (err) { next(err); }
});

router.post('/:id/approve', async (req, res, next) => {
  try {
    const account = await Accounts.setStatus(Number(req.params.id), 'approved', req.body?.department);
    if (!account) return res.status(404).json({ error: 'Account not found' });
    await Audit.log({ actorId: req.user.id, action: 'approved account for', ticketId: account.name });
    res.json({ account: publicAccount(account) });
  } catch (err) { next(err); }
});

router.post('/:id/deny', async (req, res, next) => {
  try {
    const account = await Accounts.setStatus(Number(req.params.id), 'denied');
    if (!account) return res.status(404).json({ error: 'Account not found' });
    await Audit.log({ actorId: req.user.id, action: 'denied account for', ticketId: account.name });
    res.json({ account: publicAccount(account) });
  } catch (err) { next(err); }
});

module.exports = router;
