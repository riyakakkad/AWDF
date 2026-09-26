const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'practical9_secret_key_2026';

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // If no token, allow public access for demonstration while setting req.user to null
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired authentication token' });
  }
};

module.exports = {
  authMiddleware,
  JWT_SECRET
};
