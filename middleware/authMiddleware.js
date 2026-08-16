const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;

    if (!token) {
      return res.status(401).json({ message: 'Access Denied: No Token Provided' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'supersecretgymkey2026', (err, decoded) => {
      if (err) {
        return res.status(403).json({ message: 'Invalid or Expired Token' });
      }
      req.user = decoded;
      next();
    });
  } catch (error) {
    return res.status(403).json({ message: 'Authentication error: ' + error.message });
  }
};

const verifyAdminOrOwner = (req, res, next) => {
  if (!req.user || !['ADMIN', 'GYM_OWNER'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Access Denied: Administrative Privileges Required' });
  }
  next();
};

module.exports = {
  verifyToken,
  verifyAdminOrOwner
};