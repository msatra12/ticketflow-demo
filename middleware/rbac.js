// middleware/rbac.js
const isITStaff = (user) => user.department === 'IT';
const isAdmin = (user) => user.role === 'admin';

function requireITStaff(req, res, next) {
  if (!isITStaff(req.user)) return res.status(403).json({ error: 'IT department access required' });
  next();
}
function requireAdmin(req, res, next) {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin access required' });
  next();
}

module.exports = { isITStaff, isAdmin, requireITStaff, requireAdmin };
