import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export function requireAuth(req, res, next) {
  // Accept token from Authorization header OR query param (needed for <video src>)
  const authHeader = req.headers.authorization;
  const token = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.split(' ')[1]
    : req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
