import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'vyno',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+00:00',
});

export async function initDatabase() {
  let conn;
  try {
    // Connect without selecting a DB first to create it
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true,
    });

    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
    await conn.query(schema);

    // Run incremental migrations — add columns only if they don't exist
    const colMigrations = [
      { table: 'projects', col: 'assets_manifest', def: 'JSON DEFAULT NULL' },
      { table: 'projects', col: 'project_path',    def: 'VARCHAR(255) DEFAULT NULL' },
      { table: 'projects', col: 'storyboard',      def: 'JSON DEFAULT NULL' },
      { table: 'messages', col: 'metadata',        def: 'JSON DEFAULT NULL' },
    ];
    for (const { table, col, def } of colMigrations) {
      const [existing] = await conn.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = 'vyno' AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, col]
      );
      if (existing.length === 0) {
        await conn.query(`ALTER TABLE vyno.${table} ADD COLUMN ${col} ${def}`).catch(() => {});
      }
    }

    console.log('[DB] Schema initialized');
  } catch (err) {
    console.error('[DB] Init error:', err.message);
    throw err;
  } finally {
    if (conn) await conn.end();
  }
}

export default pool;
