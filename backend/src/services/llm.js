import dotenv from 'dotenv';
dotenv.config();

const CF_BASE = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run`;
const CF_API_URL = `${CF_BASE}/${process.env.CF_AI_MODEL}`;
const CF_TOKEN = process.env.CF_AI_TOKEN;

// Llama model used for prompt rewriting (fast, cheap)
const LLAMA_MODEL = process.env.CF_LLAMA_MODEL || '@cf/meta/llama-3.1-8b-instruct';

const REWRITE_SYSTEM = `You are a professional motion design creative director and prompt engineer.
Your task: transform the user's raw idea into a detailed, production-ready motion design brief.

OUTPUT FORMAT — return ONLY a JSON object, no commentary:
{
  "rewritten_prompt": "<the full enriched prompt in the same language as the user's input>",
  "was_enriched": true|false
}

RULES:
- If the user's prompt already has sufficient detail (>60 words with style/color/animation specifics), set was_enriched=false and only lightly polish it.
- If the prompt is vague/short (<60 words), set was_enriched=true and expand it with ALL of:
  • Background color and texture (e.g. "deep black #050510 with subtle grain")
  • Typography style (font, weight, size hierarchy)
  • Color palette (primary, accent, neutral — with hex codes)
  • Animation style (e.g. "kinetic typography", "reveal wipe", "glitch", "float in")
  • Number of scenes and their purpose (intro/content/cta)
  • Specific text to display in each scene
  • Mood/tone (cinematic, playful, corporate, minimal, etc.)
  • Sound design hint (energetic beat, calm ambient, etc.)
- Keep the same language as the input (French stays French, English stays English).
- Do NOT invent brand names or facts not present in the original.
- Output ONLY valid JSON. No markdown, no explanation.`;

/**
 * Rewrites a raw user prompt into a detailed motion design brief using Llama.
 * Returns the enriched prompt string (falls back to original on error).
 * @param {string} userPrompt
 * @returns {Promise<{prompt: string, wasEnriched: boolean}>}
 */
export async function rewritePrompt(userPrompt) {
  try {
    const llamaUrl = `${CF_BASE}/${LLAMA_MODEL}`;
    const payload = {
      messages: [
        { role: 'system', content: REWRITE_SYSTEM },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 2048,
    };

    const response = await fetch(llamaUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) return { prompt: userPrompt, wasEnriched: false };

    const data = await response.json();
    if (!data.success) return { prompt: userPrompt, wasEnriched: false };

    const raw = data.result?.response || '';
    // Strip possible <think> tags from Llama output
    const clean = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    // Extract JSON
    const jsonStr = clean.match(/\{[\s\S]*\}/)?.[0];
    if (!jsonStr) return { prompt: userPrompt, wasEnriched: false };

    const parsed = JSON.parse(jsonStr);
    const enriched = parsed.rewritten_prompt?.trim();
    if (!enriched) return { prompt: userPrompt, wasEnriched: false };

    return { prompt: enriched, wasEnriched: parsed.was_enriched === true };
  } catch {
    return { prompt: userPrompt, wasEnriched: false };
  }
}

// Max messages kept in history sent to LLM (to preserve precision)
const MAX_HISTORY = 6;

/**
 * Finds the first balanced JSON object in a string.
 * More reliable than a greedy regex for nested structures.
 */
function extractFirstJSON(str) {
  const start = str.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < str.length; i++) {
    const ch = str[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return str.slice(start, i + 1);
    }
  }
  return null;
}

export function parseLLMResponse(raw) {
  let think = '';
  let remaining = raw;

  const thinkMatch = raw.match(/<think>([\s\S]*?)<\/think>/i);
  if (thinkMatch) {
    think = thinkMatch[1].trim();
    remaining = raw.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
  }

  let json = null;
  let text = remaining;

  // Try fenced code block first
  const fenced = remaining.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      json = JSON.parse(fenced[1].trim());
      text = remaining.replace(fenced[0], '').trim();
      return { think, json, text };
    } catch { /* fall through */ }
  }

  // Try balanced-brace extraction
  const jsonStr = extractFirstJSON(remaining);
  if (jsonStr) {
    try {
      json = JSON.parse(jsonStr);
      text = remaining.replace(jsonStr, '').trim();
    } catch {
      json = null;
    }
  }

  return { think, json, text };
}

/**
 * Calls Cloudflare AI with message history
 * @param {Array} messages - [{role, content}]
 * @param {Array} history  - previous chat [{role, content}] (will be trimmed)
 * @returns {{ think: string, json: object|null, text: string, raw: string }}
 */
export async function callLLM(messages, history = []) {
  // Keep only the last MAX_HISTORY messages from history
  const trimmedHistory = history.slice(-MAX_HISTORY);

  // System message must always be first — extract it from messages array
  const systemMsg = messages.find((m) => m.role === 'system');
  const nonSystem = messages.filter((m) => m.role !== 'system');

  const payload = {
    messages: [
      ...(systemMsg ? [systemMsg] : []),
      ...trimmedHistory,
      ...nonSystem,
    ],
    max_tokens: 16000,
  };

  const response = await fetch(CF_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CF_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM API error ${response.status}: ${errText}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(`LLM API failed: ${JSON.stringify(data.errors)}`);
  }

  const raw = data.result?.response || '';
  return { ...parseLLMResponse(raw), raw };
}
