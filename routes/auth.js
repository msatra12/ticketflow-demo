// routes/auth.js
const router = require('express').Router();
const { Accounts } = require('../db/repositories');
const { signToken, requireAuth } = require('../middleware/auth');

function publicAccount(a) {
  return { id: a.id, name: a.name, email: a.email, department: a.department, role: a.role, status: a.status, createdAt: new Date(a.created_at).getTime() };
}

router.post('/signup', async (req, res, next) => {
  try {
    const { name, email, password, department } = req.body || {};
    if (!name || !email || !password || !department) {
      return res.status(400).json({ error: 'name, email, password, and department are required' });
    }
    if (await Accounts.findByEmail(email)) {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }
    const account = await Accounts.create({ name, email, password, department });
    res.status(201).json({ message: 'Access request submitted. An admin will review and approve your account.', account: publicAccount(account) });
  } catch (err) { next(err); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const account = await Accounts.findByEmail(email || '');
    if (!account) return res.status(401).json({ error: 'No account found with that email' });
    if (account.status === 'pending') return res.status(403).json({ error: 'Account is awaiting admin approval' });
    if (account.status === 'denied') return res.status(403).json({ error: 'Access request was denied' });
    if (!Accounts.verifyPassword(account, password || '')) return res.status(401).json({ error: 'Incorrect password' });
    res.json({ token: signToken(account), user: publicAccount(account) });
  } catch (err) { next(err); }
});

router.get('/me', requireAuth, (req, res) => res.json({ user: publicAccount(req.user) }));

module.exports = { router, publicAccount };
