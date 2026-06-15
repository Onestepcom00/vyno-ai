import { promises as fs } from 'fs';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash';

/**
 * Analyzes an image using Gemini Vision and returns a detailed motion-design-ready description.
 * Falls back to Cloudflare llama if Gemini key is not set.
 *
 * @param {string} imagePath - absolute path to image file
 * @param {string} filename - original filename for context
 * @returns {Promise<string>} detailed description for LLM context
 */
export async function describeImageForMotionDesign(imagePath, filename) {
  if (GEMINI_API_KEY) {
    return describeWithGemini(imagePath, filename);
  }
  return describeWithCloudflare(imagePath, filename);
}

async function describeWithGemini(imagePath, filename) {
  try {
    const imageBuffer = await fs.readFile(imagePath);
    const base64 = imageBuffer.toString('base64');
    const mimeType = getMimeType(filename);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const prompt = `You are a professional motion designer and UI analyst.
Analyze this image "${filename}" with MAXIMUM DETAIL for use in a video composition.

Provide ALL of the following:
1. IMAGE TYPE: logo / UI interface / illustration / photo / icon / mockup / abstract
2. EXACT COLORS: list every significant color as hex code (background, primary, secondary, text, accents)
3. VISUAL ELEMENTS: describe every visible element (shapes, text, icons, sections, layouts)
4. IF UI/INTERFACE: describe the layout in detail — header, sections, buttons, typography, spacing, visual hierarchy
5. BACKGROUND: is it transparent / solid / gradient? Color(s)?
6. MOOD & STYLE: cinematic / corporate / playful / minimal / dark / neon / etc.
7. CSS RECREATION HINTS: suggest specific CSS techniques to recreate this design (gradients, border-radius, shadows, fonts)
8. VIDEO USAGE: how to best use this asset in a motion design video

Be extremely precise. A developer will recreate this in CSS without seeing the image.`;

    const body = {
      contents: [{
        parts: [
          { inline_data: { mime_type: mimeType, data: base64 } },
          { text: prompt },
        ],
      }],
      generationConfig: { maxOutputTokens: 1024, temperature: 0.2 },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[VISION] Gemini error:', err.slice(0, 300));
      return `Asset: ${filename} (vision analysis failed)`;
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text
      ? `=== ASSET ANALYSIS: "${filename}" ===\n${text.trim()}\n=== END ANALYSIS ===`
      : `Asset: ${filename}`;
  } catch (err) {
    console.error('[VISION] Gemini exception:', err.message);
    return `Asset: ${filename}`;
  }
}

async function describeWithCloudflare(imagePath, filename) {
  const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
  const CF_AI_TOKEN = process.env.CF_AI_TOKEN;

  if (!CF_ACCOUNT_ID || !CF_AI_TOKEN) {
    return `Asset: ${filename} (no vision API configured — add GEMINI_API_KEY to .env)`;
  }

  try {
    const imageBuffer = await fs.readFile(imagePath);
    const base64 = imageBuffer.toString('base64');
    const mimeType = getMimeType(filename);

    const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.2-11b-vision-instruct`;

    const body = {
      messages: [
        { role: 'system', content: 'You are a motion design assistant. Describe images in detail for CSS recreation.' },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
            { type: 'text', text: `Describe "${filename}" in detail: colors (hex), elements, layout, style, mood. For UI interfaces describe every section. Be precise.` },
          ],
        },
      ],
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${CF_AI_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) return `Asset: ${filename}`;

    const data = await response.json();
    const description = data?.result?.response || '';
    return description ? `Asset "${filename}": ${description.trim()}` : `Asset: ${filename}`;
  } catch (err) {
    console.error('[VISION] Cloudflare fallback error:', err.message);
    return `Asset: ${filename}`;
  }
}

function getMimeType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const map = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
  return map[ext] || 'image/png';
}
