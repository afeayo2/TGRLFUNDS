// middleware/staffAuth.js
const jwt = require('jsonwebtoken');

function authenticateStaff(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token, access denied' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== 'staff') {
      return res.status(403).json({ message: 'Access forbidden: staff only' });
    }

    req.staffId = decoded.id; // Add staffId to request
    req.staff = decoded;      // Also keep whole staff payload
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

module.exports = authenticateStaff;
