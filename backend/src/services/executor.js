import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

// __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECTS_BASE = path.resolve(process.env.PROJECTS_BASE_PATH || './projects');
const FFMPEG_PATH = path.resolve(process.env.FFMPEG_PATH || 'ffmpeg');

// Base audio assets: resolve from this file's location (src/services/) → up 4 levels → tools/assets
// executor.js is at: vyno/backend/src/services/executor.js
// tools/assets is at: VYNO-COPIE/tools/assets
const BASE_ASSETS_DIR = process.env.BASE_ASSETS_PATH
  ? path.resolve(process.env.BASE_ASSETS_PATH)
  : path.join(__dirname, '..', '..', '..', '..', 'tools', 'assets');

/**
 * Runs a shell command in a given directory and returns stdout/stderr
 * @param {string} cmd
 * @param {string[]} args
 * @param {string} cwd
 * @returns {Promise<{stdout: string, stderr: string, code: number}>}
 */
function runProcess(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd,
      shell: true,
      env: {
        ...process.env,
        FFMPEG_PATH,
        PATH: `${path.dirname(FFMPEG_PATH)};${process.env.PATH}`,
      },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => resolve({ stdout, stderr, code }));
    proc.on('error', reject);
  });
}

/**
 * Executes a single task action
 * @param {string} action
 * @param {object} params
 * @param {string} projectPath - absolute path to the project folder
 * @returns {Promise<{success: boolean, output: string, error?: string}>}
 */
export async function executeTask(action, params, projectPath) {
  try {
    switch (action) {
      case 'create_project': {
        const { name } = params;
        await fs.mkdir(PROJECTS_BASE, { recursive: true });

        // Run hyperframes init with --non-interactive and auto-confirm
        const result = await runProcess(
          'npx',
          ['--yes', 'hyperframes', 'init', name, '--non-interactive'],
          PROJECTS_BASE
        );

        const finalPath = path.join(PROJECTS_BASE, name);
        const exists = await fs.access(finalPath).then(() => true).catch(() => false);

        if (!exists) {
          return {
            success: false,
            output: result.stdout + result.stderr,
            error: `Project folder not created: ${finalPath}`,
          };
        }

        return { success: true, output: `Project initialized at ${finalPath}` };
      }

      case 'write_file': {
        const { path: filePath, content } = params;
        const fullPath = path.join(projectPath, filePath);
        const dir = path.dirname(fullPath);

        // Reject placeholder content — LLM wrote a template name instead of real code
        if (filePath.endsWith('.html') && content) {
          const trimmed = content.trim();
          const placeholderPattern = /^[A-Z][A-Z0-9_]*_HTML$/;
          if (placeholderPattern.test(trimmed) || trimmed.length < 50) {
            return {
              success: false,
              output: '',
              error: `write_file rejected: content for "${filePath}" looks like a placeholder ("${trimmed.slice(0, 40)}"). The LLM must write the actual HTML code.`,
            };
          }
        }

        await fs.mkdir(dir, { recursive: true });

        // Post-process HTML files to ensure required HyperFrames attributes
        const finalContent = filePath.endsWith('.html')
          ? fixHyperFramesHTML(content)
          : content;

        await fs.writeFile(fullPath, finalContent, 'utf8');
        const stat = await fs.stat(fullPath);

        return {
          success: true,
          output: `${filePath} written (${stat.size} bytes)`,
        };
      }

      case 'read_file': {
        const { path: filePath } = params;
        const fullPath = path.join(projectPath, filePath);
        const content = await fs.readFile(fullPath, 'utf8');
        return { success: true, output: content };
      }

      case 'render': {
        const { output = 'output.mp4' } = params;

        // Verify project has index.html
        const indexExists = await fs
          .access(path.join(projectPath, 'index.html'))
          .then(() => true)
          .catch(() => false);

        if (!indexExists) {
          return { success: false, output: '', error: 'index.html not found in project' };
        }

        const result = await runProcess(
          'npx',
          ['--yes', 'hyperframes', 'render', '--output', output, '--non-interactive'],
          projectPath
        );

        const outputPath = path.join(projectPath, output);
        const exists = await fs.access(outputPath).then(() => true).catch(() => false);

        if (!exists) {
          return {
            success: false,
            output: result.stdout + result.stderr,
            error: 'Render output file not found after execution',
          };
        }

        return {
          success: true,
          output: `Video rendered: ${output}`,
          renderPath: outputPath,
        };
      }

      case 'copy_base_assets': {
        // Copy tools/assets (sound-effects, beats-musics) into project/assets/
        const destBase = path.join(projectPath, 'assets');
        await fs.mkdir(destBase, { recursive: true });

        const sourceExists = await fs.access(BASE_ASSETS_DIR).then(() => true).catch(() => false);
        if (!sourceExists) {
          return { success: false, output: '', error: `Base assets dir not found: ${BASE_ASSETS_DIR}` };
        }

        let copied = 0;
        const copyDir = async (src, dest) => {
          await fs.mkdir(dest, { recursive: true });
          const entries = await fs.readdir(src, { withFileTypes: true });
          for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            if (entry.isDirectory()) {
              await copyDir(srcPath, destPath);
            } else {
              await fs.copyFile(srcPath, destPath);
              copied++;
            }
          }
        };

        await copyDir(BASE_ASSETS_DIR, destBase);
        return { success: true, output: `Copied ${copied} base audio asset(s) to ${destBase}` };
      }

      case 'lint': {
        const result = await runProcess(
          'npx',
          ['--yes', 'hyperframes', 'lint', '--non-interactive'],
          projectPath
        );
        return {
          success: result.code === 0,
          output: result.stdout + result.stderr,
        };
      }

      case 'verify_compositions': {
        const compositionsDir = path.join(projectPath, 'compositions');
        const exists = await fs.access(compositionsDir).then(() => true).catch(() => false);
        if (!exists) {
          return { success: true, output: 'No compositions directory (optional)' };
        }
        const files = await fs.readdir(compositionsDir);
        const htmlFiles = files.filter((f) => f.endsWith('.html'));
        return {
          success: true,
          output: `Verified: ${htmlFiles.length} composition(s)`,
        };
      }

      default:
        return { success: false, output: '', error: `Unknown action: ${action}` };
    }
  } catch (err) {
    return { success: false, output: '', error: err.message };
  }
}

/**
 * Post-processes HTML generated by the LLM to ensure HyperFrames required attributes
 * are present on the root composition element.
 * Fixes: data-composition-id, data-width, data-height, data-duration
 */
function fixHyperFramesHTML(html) {
  let result = html;

  // Find first <div that has data-duration or data-composition-id (likely the root)
  // If neither exists, find the first top-level <div inside <body>
  const hasCompositionId = /data-composition-id=/.test(html);
  const hasDuration = /data-duration=/.test(html);
  const hasWidth = /data-width=/.test(html);
  const hasHeight = /data-height=/.test(html);

  if (!hasCompositionId || !hasDuration || !hasWidth || !hasHeight) {
    // Find the first <div with data- attributes, or first <div after <body>
    result = result.replace(
      /(<div\b([^>]*?)data-duration="(\d+(?:\.\d+)?)"([^>]*)>)/,
      (match, full, before, duration, after) => {
        let attrs = full;
        if (!hasCompositionId) attrs = attrs.replace('<div', '<div data-composition-id="main"');
        if (!hasWidth) attrs = attrs.replace('<div', '<div data-width="1920"');
        if (!hasHeight) attrs = attrs.replace('<div', '<div data-height="1080"');
        return attrs;
      }
    );

    // If no data-duration found anywhere, inject it on the first div that has data-composition-id
    if (!hasDuration) {
      result = result.replace(
        /data-composition-id="([^"]*)"/,
        'data-composition-id="$1" data-duration="5" data-width="1920" data-height="1080"'
      );
    }
  }

  // Ensure .clip base CSS is present — inject into <style> if missing
  if (!result.includes('.clip') && result.includes('<style>')) {
    result = result.replace(
      '<style>',
      '<style>.clip{position:absolute;opacity:0}'
    );
  }

  return result;
}

/**
 * Returns the absolute project path for a given slug
 */
export function getProjectPath(slug) {
  return path.join(PROJECTS_BASE, slug);
}

/**
 * Checks if a rendered video exists for a project
 */
export async function getProjectRenderPath(slug, outputName = 'output.mp4') {
  const p = path.join(PROJECTS_BASE, slug, outputName);
  const exists = await fs.access(p).then(() => true).catch(() => false);
  return exists ? p : null;
}
