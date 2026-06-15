import express from 'express';
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import { requireAuth } from '../middleware/auth.js';
import db from '../db/connection.js';

const UPLOADS_DIR = path.resolve('./uploads');

const router = express.Router();

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await fs.mkdir(UPLOADS_DIR, { recursive: true }).catch(() => {});
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `avatar-${req.user.id}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// GET /api/user/profile
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, username, email, avatar_url, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/user/profile
router.patch('/profile', requireAuth, async (req, res) => {
  const { username } = req.body;
  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const [existing] = await db.query(
      'SELECT id FROM users WHERE username = ? AND id != ?',
      [username, req.user.id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    await db.query('UPDATE users SET username = ? WHERE id = ?', [username, req.user.id]);
    const [rows] = await db.query(
      'SELECT id, username, email, avatar_url FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json({ user: rows[0] });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/user/avatar — upload profile picture
router.post('/avatar', requireAuth, upload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image provided' });

  try {
    const avatarUrl = `/api/user/avatar/${req.user.id}${path.extname(req.file.filename)}`;
    await db.query('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, req.user.id]);
    const [rows] = await db.query(
      'SELECT id, username, email, avatar_url FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json({ user: rows[0] });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/user/avatar/:filename — serve avatar image (public)
router.get('/avatar/:filename', async (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(UPLOADS_DIR, filename);
    const exists = await fs.access(filePath).then(() => true).catch(() => false);
    if (!exists) return res.status(404).json({ error: 'Not found' });
    res.sendFile(filePath);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
