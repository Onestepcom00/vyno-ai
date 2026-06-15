import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth.js';
import db from '../db/connection.js';

const router = express.Router();

/**
 * POST /api/projects/new
 * Creates a new empty project with a temporary name.
 * The LLM will assign the real name and slug when the first message is processed.
 */
router.post('/new', requireAuth, async (req, res) => {
  try {
    const tempSlug = `project-${Date.now()}`;
    const id = uuidv4();

    await db.query(
      `INSERT INTO projects (id, user_id, name, slug, status)
       VALUES (?, ?, ?, ?, 'initializing')`,
      [id, req.user.id, 'New Project', tempSlug]
    );

    res.status(201).json({ project: { id, name: 'New Project', slug: tempSlug } });
  } catch (err) {
    console.error('[PROJECT] New error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
