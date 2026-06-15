import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import { requireAuth } from '../middleware/auth.js';
import db from '../db/connection.js';
import { getProjectPath, getProjectRenderPath } from '../services/executor.js';

const router = express.Router();

// GET /api/projects — list user projects
router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, name, slug, description, status, visual_identity, render_path, created_at, updated_at
       FROM projects WHERE user_id = ? ORDER BY updated_at DESC`,
      [req.user.id]
    );
    res.json({ projects: rows });
  } catch (err) {
    console.error('[PROJECTS] List error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/projects/:id — get single project with messages and tasks
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM projects WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = rows[0];

    const [messages] = await db.query(
      'SELECT id, project_id, role, content, think_content, metadata, created_at FROM messages WHERE project_id = ? ORDER BY created_at ASC',
      [project.id]
    );

    const [tasks] = await db.query(
      'SELECT * FROM tasks WHERE project_id = ? ORDER BY position ASC',
      [project.id]
    );

    // Check if render exists
    const renderExists = project.render_path
      ? await fs.access(project.render_path).then(() => true).catch(() => false)
      : false;

    res.json({ project, messages, tasks, renderExists });
  } catch (err) {
    console.error('[PROJECTS] Get error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, slug, project_path FROM projects WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = rows[0];

    // Delete project folder if exists (project_path is slug+id, fallback to slug)
    const folderRef = project.project_path || project.slug;
    const projectPath = getProjectPath(folderRef);
    await fs.rm(projectPath, { recursive: true, force: true });

    await db.query('DELETE FROM projects WHERE id = ?', [project.id]);

    res.json({ message: 'Project deleted' });
  } catch (err) {
    console.error('[PROJECTS] Delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/projects/:id/video — stream video file
router.get('/:id/video', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT slug, render_path FROM projects WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const renderPath = rows[0].render_path;
    if (!renderPath) {
      return res.status(404).json({ error: 'No render available' });
    }

    const exists = await fs.access(renderPath).then(() => true).catch(() => false);
    if (!exists) {
      return res.status(404).json({ error: 'Video file not found' });
    }

    const stat = await fs.stat(renderPath);
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/mp4',
      });

      const { createReadStream } = await import('fs');
      createReadStream(renderPath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type': 'video/mp4',
      });
      const { createReadStream } = await import('fs');
      createReadStream(renderPath).pipe(res);
    }
  } catch (err) {
    console.error('[PROJECTS] Video stream error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/projects/:id/renders — list historical renders
router.get('/:id/renders', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, slug, project_path, render_path FROM projects WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Project not found' });

    const project = rows[0];
    const folderRef = project.project_path || project.slug;
    const projectPath = getProjectPath(folderRef);

    const files = await fs.readdir(projectPath).catch(() => []);
    const renders = files
      .filter(f => f.startsWith('render-') && f.endsWith('.mp4'))
      .map(f => ({
        name: f,
        timestamp: parseInt(f.replace('render-', '').replace('.mp4', '')) || 0,
      }))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);

    res.json({ renders });
  } catch (err) {
    console.error('[PROJECTS] Renders list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/projects/:id/video/:filename — stream a specific historical render
router.get('/:id/video/:filename', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT slug, project_path FROM projects WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Project not found' });

    const project = rows[0];
    const folderRef = project.project_path || project.slug;
    const projectPath = getProjectPath(folderRef);
    const filename = path.basename(req.params.filename); // sanitize
    const filePath = path.join(projectPath, filename);

    const exists = await fs.access(filePath).then(() => true).catch(() => false);
    if (!exists) return res.status(404).json({ error: 'File not found' });

    const stat = await fs.stat(filePath);
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': 'video/mp4',
      });
      const { createReadStream } = await import('fs');
      createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Length': stat.size, 'Content-Type': 'video/mp4' });
      const { createReadStream } = await import('fs');
      createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    console.error('[PROJECTS] History video stream error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
