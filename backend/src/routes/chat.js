import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { requireAuth } from '../middleware/auth.js';
import db from '../db/connection.js';
import { callLLM, rewritePrompt } from '../services/llm.js';
import { PLAN_PROMPT, SCENE_PROMPT } from '../services/systemPrompt.js';
import { executeTask, getProjectPath } from '../services/executor.js';
import { describeImageForMotionDesign } from '../services/vision.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 50 * 1024 * 1024 } });

const router = express.Router();

/**
 * Returns a short narrative comment after a task completes.
 * Shown live in the chat to keep the user informed.
 */
function getTaskComment(action, label, output, allTasks, taskIndex) {
  const remaining = allTasks.length - taskIndex - 1;
  const next = remaining > 0 ? allTasks[taskIndex + 1] : null;

  switch (action) {
    case 'create_project':
      return `✓ Project folder initialized.${next ? ` Starting: ${next.label}...` : ''}`;
    case 'write_file': {
      const filePath = output?.match(/(\S+\.html)/)?.[1] || label;
      return `✓ Wrote \`${filePath}\`.${next ? ` Next: ${next.label}...` : ''}`;
    }
    case 'render':
      return `✓ Video rendered successfully.`;
    case 'lint':
      return `✓ Composition validated.${next ? ` Starting: ${next.label}...` : ''}`;
    default:
      return remaining > 0 ? `✓ ${label} done. Next: ${next.label}...` : `✓ ${label} done.`;
  }
}

/**
 * POST /api/chat/:projectId/message
 * 
 * Sends a user message to the LLM, executes the returned plan step by step,
 * and streams SSE events back to the client.
 * 
 * SSE event types:
 *   think      — LLM thinking block
 *   plan       — array of tasks planned
 *   task_start — task is starting (id, label)
 *   task_done  — task completed (id, success, output)
 *   task_error — task failed (id, error)
 *   message    — final assistant message
 *   done       — stream end signal
 *   error      — fatal error
 */
router.post('/:projectId/message', requireAuth, upload.array('assets', 4), async (req, res) => {
  const { projectId } = req.params;
  const { content } = req.body;

  const uploadedFiles = req.files || [];
  if ((!content || !content.trim()) && uploadedFiles.length === 0) {
    return res.status(400).json({ error: 'Message content or file required' });
  }

  // Validate project ownership
  let project;
  try {
    const [rows] = await db.query(
      'SELECT * FROM projects WHERE id = ? AND user_id = ?',
      [projectId, req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    project = rows[0];
  } catch (err) {
    return res.status(500).json({ error: 'Database error' });
  }

  // Setup SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  try {
    // Fetch history BEFORE inserting the new user message to avoid duplication
    const [historyRows] = await db.query(
      `SELECT role, content FROM messages
       WHERE project_id = ? AND role IN ('user','assistant')
       ORDER BY created_at ASC`,
      [projectId]
    );

    // ── ASSETS: copy uploaded files to projectPath/assets/ and run vision ──
    const folderRefEarly = project.project_path || project.slug;
    const projectPathEarly = getProjectPath(folderRefEarly);
    let assetDescriptions = [];
    let newAssetNames = [];

    if (uploadedFiles.length > 0) {
      // We copy assets into the actual project folder (or a staging temp if project not created yet)
      const assetsTarget = project.status === 'initializing'
        ? path.join(os.tmpdir(), `vyno-staging-${projectId}`, 'assets')
        : path.join(projectPathEarly, 'assets');

      await fs.mkdir(assetsTarget, { recursive: true });

      for (const file of uploadedFiles) {
        const dest = path.join(assetsTarget, file.originalname);
        await fs.copyFile(file.path, dest).catch(() => {});
        await fs.unlink(file.path).catch(() => {});
        newAssetNames.push(file.originalname);

        // Only run vision on images
        const isImage = /\.(png|jpg|jpeg|webp|gif)$/i.test(file.originalname);
        if (isImage) {
          const desc = await describeImageForMotionDesign(dest, file.originalname);
          assetDescriptions.push(desc);
        }
      }
    }

    // ── LOAD EXISTING ASSETS MANIFEST from DB ──
    let existingAssetsManifest = [];
    try {
      const raw = project.assets_manifest;
      existingAssetsManifest = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
    } catch { existingAssetsManifest = []; }

    // Merge new assets into manifest
    const updatedManifest = [...new Set([...existingAssetsManifest, ...newAssetNames])];

    if (newAssetNames.length > 0) {
      await db.query(
        'UPDATE projects SET assets_manifest = ? WHERE id = ?',
        [JSON.stringify(updatedManifest), projectId]
      ).catch(() => {});
      project.assets_manifest = updatedManifest;
    }

    // ── SAVE USER MESSAGE (with asset metadata) ──
    const userMsgId = uuidv4();
    const userContent = (content || '').trim() || `Assets uploaded: ${newAssetNames.join(', ')}`;
    const msgMeta = newAssetNames.length > 0 ? JSON.stringify({ assets: newAssetNames }) : null;
    await db.query(
      'INSERT INTO messages (id, project_id, role, content, metadata) VALUES (?, ?, ?, ?, ?)',
      [userMsgId, projectId, 'user', userContent, msgMeta]
    );

    // Send asset_upload event so frontend can show thumbnails near the message
    if (newAssetNames.length > 0) {
      send('asset_upload', { messageId: userMsgId, assets: newAssetNames });
    }

    // ── READ CURRENT PROJECT FILES FOR MODIFY CONTEXT ──
    const projectFiles = {};
    if (project.status !== 'initializing') {
      // Read index.html
      const indexHtml = await fs.readFile(path.join(projectPathEarly, 'index.html'), 'utf8').catch(() => null);
      if (indexHtml) projectFiles['index.html'] = indexHtml;

      // Read all composition files
      const compDir = path.join(projectPathEarly, 'compositions');
      const compFiles = await fs.readdir(compDir).catch(() => []);
      for (const f of compFiles.filter(f => f.endsWith('.html'))) {
        const content = await fs.readFile(path.join(compDir, f), 'utf8').catch(() => null);
        if (content) projectFiles[`compositions/${f}`] = content;
      }
    }

    // ── LOAD STORYBOARD + VISUAL IDENTITY FROM DB ──
    let storyboard = null;
    let visualIdentity = null;
    try {
      const raw = project.storyboard;
      storyboard = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
    } catch { storyboard = null; }
    try {
      const raw = project.visual_identity;
      visualIdentity = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
    } catch { visualIdentity = null; }

    // ── READ AVAILABLE BEATS/MUSIC TRACKS ──
    // chat.js is at vyno/backend/src/routes/ — go up 4 levels to reach VYNO-COPIE/tools/assets
    const baseAssetsDir = process.env.BASE_ASSETS_PATH
      ? path.resolve(process.env.BASE_ASSETS_PATH)
      : path.resolve(__dirname, '..', '..', '..', '..', 'tools', 'assets');
    const beatsDir = path.join(baseAssetsDir, 'beats-musics');
    const sfxDir = path.join(baseAssetsDir, 'sound-effects');
    const beatsList = await fs.readdir(beatsDir).catch(() => []);
    const sfxList = await fs.readdir(sfxDir).catch(() => []);

    // ── BUILD RICH CONTEXT FOR LLM ──
    const contextParts = [
      `Project: "${project.name}" | Status: ${project.status}`,
    ];

    if (beatsList.length > 0) {
      contextParts.push(`Available beats-musics tracks (use one as main background music):\n${beatsList.map(f => `- assets/beats-musics/${f}`).join('\n')}`);
    }
    if (sfxList.length > 0) {
      contextParts.push(`Available sound-effects (all listed in AUDIO ASSETS section):\n${sfxList.map(f => `- assets/sound-effects/${f}`).join('\n')}`)
    }

    if (visualIdentity) {
      contextParts.push(`Current visual_identity: ${JSON.stringify(visualIdentity)}\nIMPORTANT: If user asks to change colors/style/concept, generate a COMPLETELY different visual_identity.`);
    }

    if (storyboard) {
      contextParts.push(`Current storyboard: ${JSON.stringify(storyboard)}`);
    }

    if (updatedManifest.length > 0) {
      contextParts.push(`Available assets in ./assets/: ${updatedManifest.join(', ')}`);
      contextParts.push(`IMPORTANT: These assets EXIST on disk. Reference them exactly as: src="./assets/FILENAME"`);
    }

    if (assetDescriptions.length > 0) {
      contextParts.push(`Asset visual analysis:\n${assetDescriptions.join('\n')}`);
    }

    if (Object.keys(projectFiles).length > 0) {
      const fileEntries = Object.entries(projectFiles).map(([fname, content]) => {
        const truncated = content.length > 2500 ? content.slice(0, 2500) + '\n...[truncated]' : content;
        return `--- ${fname} ---\n${truncated}`;
      });
      contextParts.push(`Current project files (for modify_project — only rewrite what is requested):\n${fileEntries.join('\n\n')}`);
    }

    const projectContext = contextParts.join('\n\n');

    // ── PROMPT REWRITE: use Llama to enrich vague prompts before sending to DeepSeek ──
    let finalUserContent = userContent;
    const isCreation = project.status === 'initializing' || !storyboard;
    if (isCreation) {
      send('task_comment', { comment: '✨ Optimisation du prompt en cours...' });
      const rewrite = await rewritePrompt(userContent);
      finalUserContent = rewrite.prompt;
      if (rewrite.wasEnriched) {
        send('prompt_enriched', { original: userContent, enriched: finalUserContent });
      }
    }

    // ── PHASE 1: PLAN — call LLM with PLAN_PROMPT to get storyboard only (no HTML) ──
    const planSystemMsg = { role: 'system', content: PLAN_PROMPT + '\n\n=== PROJECT CONTEXT ===\n' + projectContext };
    const userMsg = { role: 'user', content: finalUserContent };
    const historyForLLM = historyRows.map((m) => ({ role: m.role, content: m.content }));

    const planResult = await callLLM([planSystemMsg, userMsg], historyForLLM);

    if (planResult.think) {
      send('think', { content: planResult.think });
    }

    const parsed = planResult.json;

    // No valid JSON → text response
    if (!parsed || !parsed.action) {
      const responseText = planResult.text || planResult.raw || 'No response';
      const assistantMsgId = uuidv4();
      await db.query(
        'INSERT INTO messages (id, project_id, role, content, think_content) VALUES (?, ?, ?, ?, ?)',
        [assistantMsgId, projectId, 'assistant', responseText, planResult.think || null]
      );
      send('message', { id: assistantMsgId, content: responseText });
      send('done', {});
      res.end();
      return;
    }

    // Simple respond
    if (parsed.action === 'respond') {
      const responseText = parsed.response || '';
      const assistantMsgId = uuidv4();
      await db.query(
        'INSERT INTO messages (id, project_id, role, content, think_content) VALUES (?, ?, ?, ?, ?)',
        [assistantMsgId, projectId, 'assistant', responseText, planResult.think || null]
      );
      send('message', { id: assistantMsgId, content: responseText });
      send('done', {});
      res.end();
      return;
    }

    // Handle create_motion or modify_project — two-phase generation
    if (parsed.action === 'create_motion' || parsed.action === 'modify_project') {
      const storyboardPlan = parsed.storyboard || [];
      const totalDuration = storyboardPlan.reduce((s, sc) => s + (sc.duration || 0), 0);

      // Build task list: create_project + one write_file per scene file + index.html + render
      const filesToGenerate = [
        { path: 'index.html', label: 'Write index.html', type: 'index' },
        ...storyboardPlan.map((sc) => ({
          path: sc.file,
          label: `Write ${sc.file}`,
          type: 'scene',
          compId: sc.compId,
          duration: sc.duration,
          description: sc.description,
          scene: sc.scene,
        })),
      ];

      const taskRecordsRaw = [
        ...(parsed.action === 'create_motion' ? [
          { action: 'create_project', label: 'Init project', params: {} },
          { action: 'copy_base_assets', label: 'Copy audio assets', params: {} },
        ] : []),
        ...filesToGenerate.map((f) => ({ action: 'write_file', label: f.label, params: { path: f.path }, _meta: f })),
        { action: 'render', label: 'Render video', params: { output: 'output.mp4' } },
      ];

      const tasks = taskRecordsRaw;

      // Update project metadata if creation
      if (parsed.action === 'create_motion') {
        const suffix = projectId.substring(0, 8);
        const rawSlug = `${(parsed.project_name || project.slug)
          .toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 32)}-${suffix}`;
        // Reuse existing project_path if already set; otherwise create new one
        const folderName = project.project_path && project.project_path !== project.slug
          ? project.project_path
          : rawSlug;
        const title = parsed.title || project.name;
        const description = parsed.description || null;
        const concept = parsed.concept || null;
        const visualIdentity = parsed.visual_identity || null;
        const storyboardData = parsed.storyboard || null;

        await db.query(
          `UPDATE projects SET
            name = ?, slug = ?, project_path = ?, description = ?, concept = ?,
            visual_identity = ?, storyboard = ?, status = 'in_progress'
           WHERE id = ?`,
          [title, rawSlug, folderName, description, concept,
           JSON.stringify(visualIdentity), storyboardData ? JSON.stringify(storyboardData) : null,
           projectId]
        );

        project.slug = rawSlug;
        project.project_path = folderName;

        // Move any staged assets to the real project folder (after create_project task runs)
        const stagingDir = path.join(os.tmpdir(), `vyno-staging-${projectId}`, 'assets');
        const stagingExists = await fs.access(stagingDir).then(() => true).catch(() => false);
        if (stagingExists) {
          project._stagingAssets = stagingDir;
        }
      }

      // On modify_project: update visual_identity and/or storyboard if LLM returned them
      if (parsed.action === 'modify_project') {
        const updates = [];
        const vals = [];
        if (parsed.visual_identity) {
          updates.push('visual_identity = ?');
          vals.push(JSON.stringify(parsed.visual_identity));
        }
        if (parsed.storyboard) {
          updates.push('storyboard = ?');
          vals.push(JSON.stringify(parsed.storyboard));
        }
        if (updates.length > 0) {
          updates.push("status = 'in_progress'");
          vals.push(projectId);
          await db.query(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`, vals);
        }
      }

      // Build plan in DB (preserve _meta for phase-2 HTML generation)
      const taskRecords = tasks.map((t, i) => ({
        id: uuidv4(),
        project_id: projectId,
        action: t.action,
        label: t.label || t.action,
        params: JSON.stringify(t.params || {}),
        position: i,
        status: 'pending',
        _meta: t._meta || null,
      }));

      if (taskRecords.length > 0) {
        const placeholders = taskRecords.map(() => '(?,?,?,?,?,?,?)').join(',');
        const values = taskRecords.flatMap((t) => [
          t.id, t.project_id, t.action, t.label, t.params, t.position, t.status,
        ]);
        await db.query(
          `INSERT INTO tasks (id, project_id, action, label, params, position, status) VALUES ${placeholders}`,
          values
        ).catch(() => {});
      }

      // Send plan to client
      send('plan', {
        tasks: taskRecords.map((t) => ({
          id: t.id,
          label: t.label,
          action: t.action,
          status: 'pending',
        })),
        metadata: {
          title: parsed.title,
          description: parsed.description,
          visual_identity: parsed.visual_identity,
          scenes: parsed.scenes,
        },
      });

      // Execute tasks sequentially — use project_path (slug+id) if set, else slug
      const folderRef = project.project_path || project.slug;
      const projectPath = getProjectPath(folderRef);
      let allSuccess = true;
      let finalRenderPath = null;

      for (const task of taskRecords) {
        send('task_start', { id: task.id, label: task.label });

        if (task.action === 'render') {
          send('task_comment', { comment: '🎬 Rendering video... This can take 30–60 seconds. Hang tight.' });
        }

        await db.query('UPDATE tasks SET status = ? WHERE id = ?', ['running', task.id]).catch(() => {});

        let params = {};
        try { params = JSON.parse(task.params); } catch { params = {}; }

        if (task.action === 'create_project') {
          params = { ...params, name: folderRef };
        }

        // ── PHASE 2: For write_file, call LLM with SCENE_PROMPT to generate HTML ──
        if (task.action === 'write_file' && task._meta) {
          const meta = task._meta;
          const isIndex = meta.type === 'index';
          const vi = parsed.visual_identity || {};

          // Build per-file context
          const sceneContextParts = [
            `Project: "${parsed.title || project.name}"`,
            `Concept: ${parsed.concept || 'motion design'}`,
            `Visual identity: background=${vi.background||'#0a0a0f'} primary=${vi.primary||'#1a1a2f'} accent=${vi.accent||'#7b2fff'} text=${vi.text||'#ffffff'} font=${vi.font||'Inter'}`,
            `Total video duration: ${totalDuration}s`,
          ];

          if (isIndex) {
            sceneContextParts.push('FILE TO GENERATE: index.html (root orchestrator)');
            sceneContextParts.push(`Scenes:\n${storyboardPlan.map((sc, i) => {
              const start = storyboardPlan.slice(0, i).reduce((s, x) => s + x.duration, 0);
              return `  scene ${sc.scene}: compId="${sc.compId}" file="${sc.file}" data-start=${start} data-duration=${sc.duration} | ${sc.description || ''}`;
            }).join('\n')}`);
            // Audio context for index.html
            if (beatsList.length > 0) {
              sceneContextParts.push(`Available music tracks: ${beatsList.map(f => `assets/beats-musics/${f}`).join(', ')}\nPick ONE as main background music.`);
            } else {
              sceneContextParts.push('No beats-musics tracks available — use SFX only, no main music track.');
            }
            sceneContextParts.push(`Available SFX: ${sfxList.map(f => `assets/sound-effects/${f}`).join(', ')}`);
            sceneContextParts.push(`AUDIO TASK: Add <audio> elements in index.html for: 1) main music (full duration, vol 0.4), 2) SFX timed to scene moments (typing, glitch, notification as appropriate). All audio data-track-index must be 5+.`);
          } else {
            sceneContextParts.push(`FILE TO GENERATE: ${meta.path}`);
            sceneContextParts.push(`compId: ${meta.compId}`);
            sceneContextParts.push(`Scene duration: ${meta.duration}s`);
            sceneContextParts.push(`Scene description: ${meta.description}`);
            sceneContextParts.push(`Scene ${meta.scene} of ${storyboardPlan.length}`);
            // List already-written files for context continuity
            const written = taskRecords
              .filter(t => t.action === 'write_file' && t._meta && t._taskDone)
              .map(t => t._meta.path);
            if (written.length > 0) {
              sceneContextParts.push(`Already written files (for style consistency): ${written.join(', ')}`);
            }
          }

          if (updatedManifest.length > 0) {
            sceneContextParts.push(`Available assets: ${updatedManifest.join(', ')} (reference as ../assets/FILENAME in sub-compositions)`);
          }

          const sceneContext = sceneContextParts.join('\n');
          const sceneSystemMsg = { role: 'system', content: SCENE_PROMPT + '\n\n=== TASK CONTEXT ===\n' + sceneContext };
          const sceneUserMsg = { role: 'user', content: `Generate the file: ${meta.path}` };

          send('task_comment', { comment: `🤖 Generating ${meta.path}...` });

          let htmlContent = '';
          try {
            const sceneResult = await callLLM([sceneSystemMsg, sceneUserMsg], []);
            htmlContent = (sceneResult.text || sceneResult.raw || '').trim();
            // Strip accidental markdown fences if any
            htmlContent = htmlContent.replace(/^```[\w]*\n?/m, '').replace(/\n?```$/m, '').trim();
          } catch (e) {
            htmlContent = '';
          }

          params = { path: meta.path, content: htmlContent };
          task._taskDone = true;
        }

        const result = await executeTask(task.action, params, projectPath);

        if (result.success) {
          await db.query(
            'UPDATE tasks SET status = ?, result = ? WHERE id = ?',
            ['completed', JSON.stringify({ output: result.output }), task.id]
          );
          send('task_done', { id: task.id, output: result.output });

          // After create_project: move staged assets into real project folder
          if (task.action === 'create_project' && project._stagingAssets) {
            const realAssetsDir = path.join(projectPath, 'assets');
            await fs.mkdir(realAssetsDir, { recursive: true });
            const staged = await fs.readdir(project._stagingAssets).catch(() => []);
            for (const f of staged) {
              await fs.copyFile(
                path.join(project._stagingAssets, f),
                path.join(realAssetsDir, f)
              ).catch(() => {});
            }
            await fs.rm(path.join(os.tmpdir(), `vyno-staging-${projectId}`), { recursive: true, force: true }).catch(() => {});
            send('task_comment', { comment: `✓ Assets copied to project folder.` });
          }

          // Send narrative comment for this task
          const comment = getTaskComment(task.action, task.label, result.output, taskRecords, taskRecords.indexOf(task));
          if (comment) send('task_comment', { comment });

          if (task.action === 'render' && result.renderPath) {
            // Rename render with timestamp to keep history
            const ts = Date.now();
            const historyName = `render-${ts}.mp4`;
            const historyPath = path.join(projectPath, historyName);
            await fs.copyFile(result.renderPath, historyPath).catch(() => {});
            finalRenderPath = result.renderPath;
          }
        } else {
          allSuccess = false;
          await db.query(
            'UPDATE tasks SET status = ?, error_message = ? WHERE id = ?',
            ['error', result.error, task.id]
          );
          send('task_error', { id: task.id, error: result.error, output: result.output });
          send('task_comment', { comment: `⚠ Task "${task.label}" failed: ${result.error?.slice(0, 100)}` });
          // Continue with remaining tasks even if one fails
        }
      }

      // Update project status and render path
      const finalStatus = allSuccess ? 'completed' : 'in_progress';
      await db.query(
        'UPDATE projects SET status = ?, render_path = ? WHERE id = ?',
        [finalStatus, finalRenderPath, projectId]
      );

      // Generate assistant summary message
      const sceneCount = parsed.storyboard?.length || tasks.filter(t => t.action === 'write_file').length;
      const summary = allSuccess
        ? `Done! ${sceneCount > 1 ? `${sceneCount}-scene` : ''} motion design generated. ${updatedManifest.length > 0 ? `Assets used: ${updatedManifest.join(', ')}.` : ''} You can preview the video on the right.`
        : `Generation completed with some errors. Check the task list for details.`;

      const assistantMsgId = uuidv4();
      await db.query(
        'INSERT INTO messages (id, project_id, role, content, think_content) VALUES (?, ?, ?, ?, ?)',
        [assistantMsgId, projectId, 'assistant', summary, planResult.think || null]
      );

      send('message', { id: assistantMsgId, content: summary });
      send('done', { renderPath: finalRenderPath });
      res.end();
      return;
    }

    // Fallback for unknown actions
    send('error', { message: `Unknown action: ${parsed.action}` });
    send('done', {});
    res.end();

  } catch (err) {
    console.error('[CHAT] Error:', err);
    try {
      send('error', { message: err.message });
      send('done', {});
    } catch {}
    res.end();
  }
});

/**
 * POST /api/chat/:projectId/render
 * Manually trigger a render for an existing project
 */
router.post('/:projectId/render', requireAuth, async (req, res) => {
  const { projectId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  try {
    const [rows] = await db.query(
      'SELECT * FROM projects WHERE id = ? AND user_id = ?',
      [projectId, req.user.id]
    );

    if (rows.length === 0) {
      send('error', { message: 'Project not found' });
      send('done', {});
      res.end();
      return;
    }

    const project = rows[0];
    const folderRef = project.project_path || project.slug;
    const projectPath = getProjectPath(folderRef);

    send('task_start', { id: 'render', label: 'Rendering video' });

    const result = await executeTask('render', { output: 'output.mp4' }, projectPath);

    if (result.success) {
      await db.query(
        'UPDATE projects SET render_path = ?, status = ? WHERE id = ?',
        [result.renderPath, 'completed', projectId]
      );
      send('task_done', { id: 'render', output: result.output });
      send('done', { renderPath: result.renderPath });
    } else {
      send('task_error', { id: 'render', error: result.error, output: result.output });
      send('done', {});
    }
  } catch (err) {
    console.error('[RENDER] Error:', err);
    send('error', { message: err.message });
    send('done', {});
  }

  res.end();
});

export default router;
