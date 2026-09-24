// middleware/auth.js
const jwt = require('jsonwebtoken');
const { Accounts } = require('../db/repositories');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me';

function signToken(account) {
  return jwt.sign({ sub: account.id }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const account = await Accounts.findById(payload.sub);
    if (!account || account.status !== 'approved') {
      return res.status(401).json({ error: 'Account not found or not approved' });
    }
    req.user = account;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { signToken, requireAuth, JWT_SECRET };
