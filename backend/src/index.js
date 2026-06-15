import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import path from 'path';
import { initDatabase } from './db/connection.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import chatRoutes from './routes/chat.js';
import userRoutes from './routes/user.js';
import newProjectRoute from './routes/newProject.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure upload and projects directories exist
await fs.mkdir('./uploads', { recursive: true });
await fs.mkdir(path.resolve(process.env.PROJECTS_BASE_PATH || './projects'), { recursive: true });

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static('./uploads'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', newProjectRoute);
app.use('/api/projects', projectRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/user', userRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[SERVER] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Init DB then start server
try {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`[SERVER] Vyno backend running on http://localhost:${PORT}`);
  });
} catch (err) {
  console.error('[SERVER] Failed to start:', err.message);
  process.exit(1);
}
