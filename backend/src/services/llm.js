import dotenv from 'dotenv';
dotenv.config();

const CF_API_URL = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/${process.env.CF_AI_MODEL}`;
const CF_TOKEN = process.env.CF_AI_TOKEN;

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
