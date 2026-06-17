<div align="center">

<img src="./attachements/vyno-design.png" alt="Vyno — Describe it. See it move." width="100%" />

<br/>

# Vyno AI - Motion Design Generator Tools

**An AI agent that turns text descriptions into rendered motion design videos.**

[![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![HyperFrames](https://img.shields.io/badge/HyperFrames-renderer-blueviolet?style=flat-square)](https://hyperframes.dev/)
[![Cloudflare AI](https://img.shields.io/badge/Cloudflare-AI-F38020?style=flat-square&logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/workers-ai/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-in%20development-orange?style=flat-square)]()



</div>

---

## What is Vyno?

**Vyno** is an open-source AI agent designed for **automated motion design generation**. You describe what you want — a product intro, a brand reveal, a personal presentation — and Vyno writes the code, renders the frames, and delivers a `.mp4` video.

Under the hood, Vyno combines three technologies:

- **Llama (prompt rewriter)** — automatically enriches vague user prompts into detailed motion design briefs before sending to the main model
- **LLM (Cloudflare AI / any provider)** — interprets the enriched prompt, plans the storyboard and visual identity, then generates HTML/CSS/JS animations for each scene individually
- **HyperFrames** — a headless browser-based video composition engine that renders HTML/CSS/GSAP animations frame-by-frame into a video
- **FFmpeg** — encodes the rendered frames + mixed audio into a final `.mp4` file

Vyno uses a **three-phase generation pipeline**: Llama first rewrites the prompt, the main LLM then produces a lightweight plan (storyboard + color palette), and finally generates each scene file in a dedicated request — ensuring high-quality, complete code output even for complex multi-scene compositions.

---

## Screenshots

<div align="center">

<img src="./attachements/vyno-app-presentation.png" alt="Vyno — AI generating a 3-scene motion design" width="100%" />
<sub>Vyno generating a 3-scene motion design from a single text prompt</sub>

<br/><br/>

<img src="./attachements/vyno-exemple-personal-project-generate.png" alt="Vyno — Asset-aware generation with photo and UI screenshot" width="100%" />
<sub>Asset-aware generation: Vyno analyzes uploaded images with vision AI and integrates them into the animation</sub>

</div>

---

## How It Works

```
User prompt
    │
    ▼
┌─────────────┐  Rewrite (new) ┌──────────────────────────┐
│             │ ─────────────► │  Llama 3.1-8B            │
│   Backend   │                │  → enriched prompt brief │
│  (Node.js)  │ ◄───────────── │  (colors, typo, scenes…) │
│             │                └──────────────────────────┘
│             │
│             │    Phase 1     ┌──────────────────────────┐
│             │ ─────────────► │  LLM (PLAN_PROMPT)       │
│             │                │  → storyboard JSON       │
│             │ ◄───────────── │  → visual_identity       │
│             │                └──────────────────────────┘
│             │
│             │    Phase 2     ┌──────────────────────────┐
│             │ ─────────────► │  LLM (SCENE_PROMPT)      │
│             │  (1 call/file) │  → raw HTML per scene    │
│             │ ◄───────────── │  (index + compositions)  │
│             │                └──────────────────────────┘
│             │
│             │    Render      ┌──────────────────────────┐
│             │ ─────────────► │  HyperFrames             │
│             │                │  Puppeteer → frames      │
│             │ ◄───────────── │  FFmpeg → output.mp4     │
└─────────────┘                └──────────────────────────┘
```

Each generated video is a **multi-file HyperFrames project**:
- `index.html` — root orchestrator with scene layout, GSAP timeline, and audio elements
- `compositions/scene1.html` — sub-composition with scoped CSS + GSAP animations
- `compositions/scene2.html` — ...
- `assets/beats-musics/` — background music tracks
- `assets/sound-effects/` — UI sound effects (typing, clicks, notifications, risers…)
- `assets/` — uploaded images, logos, screenshots

---

## Current Capabilities & Limitations

### ✅ What Vyno can do today

- Generate multi-scene motion design videos from a text prompt
- **Automatically rewrite vague prompts** into detailed briefs (colors, typography, animations, mood) using Llama before generation
- Accept uploaded assets (logo, photo, UI screenshot) — analyzed with vision AI
- **Synchronize background music and sound effects** to each scene via multi-track audio
- Stream task progress in real-time via SSE
- Re-render or iterate on existing projects with new prompts
- Download final `.mp4` output directly from the UI
- Render history per project

### ⚠️ Current Limitations

- Render quality depends heavily on the LLM model used (see [Changing the Model](#changing-the-model))
- No camera motion or 3D effects
- Complex multi-element layouts may require manual HTML tweaking

### 🔮 Upcoming Features

We are planning to extend Vyno with **MCP (Model Context Protocol) tool integrations** to give the AI access to external creative resources:

- 🖼️ **Stock images / illustrations** — via external APIs
- 🎬 **Video clips** — embed footage inside compositions
- 🔤 **Font libraries** — dynamic font selection
- 🎨 **Design system APIs** — brand kit integration

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| [Node.js](https://nodejs.org/) | 22+ | Backend + frontend |
| [MySQL](https://www.mysql.com/) | 8+ | via XAMPP or standalone |
| [FFmpeg](https://ffmpeg.org/) | 6+ | Video encoding |
| [HyperFrames](https://hyperframes.dev/) | latest | `npm i -g hyperframes` |
| Cloudflare AI account | — | Free tier available |
| Google Gemini API key | — | Optional (vision analysis fallback to Cloudflare) |

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/Onestepcom00/vyno-ai.git
cd vyno
```

### 2. Install FFmpeg

Download a pre-built binary from [ffmpeg.org/download](https://ffmpeg.org/download.html) and note the absolute path to `ffmpeg.exe` (Windows) or `ffmpeg` (Linux/macOS).

### 3. Install HyperFrames

```bash
npm install -g hyperframes
```

### 4. Set up the database

Start MySQL (via XAMPP or any MySQL server), then create the database:

```sql
CREATE DATABASE vyno CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

or you can use backend/src/db/vyno.sql

### 5. Configure the backend

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```env
PORT=3001
JWT_SECRET=change_this_to_a_random_secret_string

# MySQL
DB_HOST=localhost
DB_PORT=3306
DB_NAME=vyno
DB_USER=root
DB_PASSWORD=

# Cloudflare AI — main generation model (DeepSeek R1 recommended)
CF_ACCOUNT_ID=your_cloudflare_account_id
CF_AI_TOKEN=your_cloudflare_ai_token
CF_AI_MODEL=@cf/deepseek-ai/deepseek-r1-distill-qwen-32b

# Prompt rewriter model (Llama — fast, cheap, runs before the main LLM)
# Automatically enriches vague prompts. Leave as-is or change to any Cloudflare Llama model.
CF_LLAMA_MODEL=@cf/meta/llama-3.1-8b-instruct

# FFmpeg — MUST be an absolute path
FFMPEG_PATH=C:/path/to/ffmpeg.exe

# HyperFrames project storage
PROJECTS_BASE_PATH=./projects

# Base audio assets directory (beats-musics/ + sound-effects/ copied into every new project)
BASE_ASSETS_PATH=../tools/assets

# Optional: Google Gemini for image analysis (recommended)
GEMINI_API_KEY=your_gemini_api_key
```

### 6. Install dependencies & start

**Backend:**
```bash
cd backend
npm install
npm run dev
```
→ Runs on `http://localhost:3001`

**Frontend** (new terminal):
```bash
cd frontend
npm install
npm run dev
```
→ Runs on `http://localhost:5173`

Open `http://localhost:5173`, create an account, and start generating.

---

## Project Structure

```
vyno/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   └── connection.js       # MySQL connection + auto-schema
│   │   ├── middleware/
│   │   │   └── auth.js             # JWT authentication
│   │   ├── routes/
│   │   │   ├── chat.js             # Main generation pipeline (SSE)
│   │   │   ├── projects.js         # Project CRUD + video streaming
│   │   │   └── user.js             # Auth routes
│   │   ├── services/
│   │   │   ├── llm.js              # Cloudflare AI client
│   │   │   ├── systemPrompt.js     # PLAN_PROMPT + SCENE_PROMPT
│   │   │   ├── executor.js         # Task runner (write_file, render, etc.)
│   │   │   └── vision.js           # Image analysis (Gemini / Cloudflare)
│   │   └── index.js
│   ├── projects/                   # Auto-generated HyperFrames projects
│   └── .env
└── frontend/
    └── src/
        ├── components/             # ChatPanel, VideoPlayer, TaskList, etc.
        ├── pages/                  # Landing, Auth, Dashboard, ProjectPage
        ├── services/               # API client (REST + SSE)
        ├── store/                  # Zustand (auth, project state)
        └── styles/
```

---

## Prompt Rewriting (Llama)

When you submit a **new project**, Vyno automatically runs your prompt through a **Llama 3.1-8B rewriter** before sending it to the main generation model. This step enriches vague or short prompts into detailed, production-ready motion design briefs.

### What it adds

If your prompt is short (< 60 words), the rewriter expands it with:

| Element | Example |
|---|---|
| Background | `deep black #050510 with subtle grain` |
| Color palette | primary, accent, neutral with hex codes |
| Typography | `Inter ultra-bold 120px for titles, 28px medium for subtitles` |
| Animation style | `kinetic typography`, `reveal wipe`, `float in` |
| Scene structure | number of scenes + purpose of each |
| Mood & tone | `cinematic`, `minimal SaaS`, `energetic` |
| Sound design | `energetic funk beat`, `calm ambient` |

If your prompt is already detailed (> 60 words with style specifics), it is only lightly polished.

### How to configure

In `backend/.env`:

```env
# Model used for rewriting — any fast Cloudflare Llama model works
CF_LLAMA_MODEL=@cf/meta/llama-3.1-8b-instruct
```

To disable rewriting entirely, remove `CF_LLAMA_MODEL` from your `.env`. The pipeline falls back silently to the original prompt.

### SSE events emitted

| Event | Description |
|---|---|
| `task_comment` | Shows "✨ Optimisation du prompt..." in the chat |
| `prompt_enriched` | Contains both the original and enriched prompt (frontend can display diff) |

> Rewriting only triggers on **new project creation** — not on modification requests.

---

## Audio & Visual Composition

Vyno supports **synchronized multi-track audio** in generated motion designs. Each project's `index.html` can declare multiple `<audio>` elements with precise timing, volume, and track isolation.

### Audio asset library

Audio files are copied from `tools/assets/` into every new project at generation time:

```
assets/
├── beats-musics/        — Background music tracks
│   ├── electro-swing.mp3
│   ├── funk-breakbeat.mp3
│   ├── funk-main.mp3
│   └── vlog-chill-1.mp3
└── sound-effects/       — UI sound effects
    ├── typing-keyboard.mp3
    ├── typing-fast.mp3
    ├── click-ui.mp3
    ├── notification-chime.mp3
    └── riser-whoosh.mp3
```

The path to this library is set via `BASE_ASSETS_PATH` in `.env`:

```env
# Absolute or relative path to the assets folder
BASE_ASSETS_PATH=../tools/assets
```

### Declaring audio in index.html

Audio tracks use standard `<audio>` elements with HyperFrames data attributes:

```html
<!-- Background music — full duration, low volume -->
<audio src="./assets/beats-musics/funk-breakbeat.mp3"
  data-start="0" data-duration="17"
  data-track-index="5" data-volume="0.35"></audio>

<!-- Sound effect — triggered at specific timestamp -->
<audio src="./assets/sound-effects/click-ui.mp3"
  data-start="10.4" data-duration="0.4"
  data-track-index="7" data-volume="0.9"></audio>
```

| Attribute | Description |
|---|---|
| `data-start` | Time in seconds when this audio begins in the composition |
| `data-duration` | How long to play (can be shorter than the file) |
| `data-track-index` | Separate mixing bus (`1`–`8`). Tracks on the same index share volume. Use `5`+ for audio to avoid conflicts with video tracks. |
| `data-volume` | Volume from `0.0` to `1.0` |

### HyperFrames composition rules (audio-safe)

- All CSS scoped with `#compositionId` (not `[data-composition-id]`) to prevent style leaks
- All GSAP tweens include `overwrite: 'auto'` to prevent overlapping tween conflicts
- No `Math.random()` — use a seeded PRNG (mulberry32) for deterministic renders
- No `requestAnimationFrame` — all motion driven by GSAP timeline seeks

---

## Changing the Model

> **The render quality depends heavily on the LLM model you use.**  
> A more capable reasoning model = better HTML code = better video.

Vyno uses **Cloudflare Workers AI** by default, but you can switch to any LLM provider.

### Option A — Switch Cloudflare model

In `backend/.env`, change `CF_AI_MODEL` to any model available on your Cloudflare account:

```env
# Recommended reasoning models (better code generation):
CF_AI_MODEL=@cf/deepseek-ai/deepseek-r1-distill-qwen-32b
CF_AI_MODEL=@cf/meta/llama-3.3-70b-instruct-fp8-fast
CF_AI_MODEL=@cf/qwen/qwen2.5-coder-32b-instruct
```

Browse all available models at [developers.cloudflare.com/workers-ai/models](https://developers.cloudflare.com/workers-ai/models/).

### Option B — Switch to a different provider (OpenAI, Anthropic, Groq, Ollama...)

Edit `backend/src/services/llm.js`. The `callLLM` function is the single integration point:

```js
// Current: Cloudflare AI
const response = await fetch(CF_API_URL, {
  method: 'POST',
  headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages, max_tokens: 16000 }),
});
```

**Example — switch to OpenAI:**

```js
import OpenAI from 'openai';
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function callLLM(messages, history = []) {
  const trimmedHistory = history.slice(-6);
  const allMessages = [...messages.slice(0,1), ...trimmedHistory, ...messages.slice(1)];

  const completion = await client.chat.completions.create({
    model: 'gpt-4o',          // or o1, gpt-4-turbo, etc.
    messages: allMessages,
    max_tokens: 16000,
  });

  const raw = completion.choices[0].message.content || '';
  return { ...parseLLMResponse(raw), raw };
}
```

**Example — switch to Anthropic Claude:**

```js
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function callLLM(messages, history = []) {
  const system = messages.find(m => m.role === 'system')?.content || '';
  const nonSystem = [...history.slice(-6), ...messages.filter(m => m.role !== 'system')];

  const msg = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 16000,
    system,
    messages: nonSystem,
  });

  const raw = msg.content[0].text || '';
  return { ...parseLLMResponse(raw), raw };
}
```

> **Tip:** Models with strong reasoning and code generation capabilities produce significantly better results. `deepseek-r1`, `claude-opus`, and `gpt-4o` are recommended.

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Backend port (default: `3001`) |
| `JWT_SECRET` | **Yes** | Secret for JWT signing — change before deploying |
| `DB_HOST` | **Yes** | MySQL host (usually `localhost`) |
| `DB_PORT` | No | MySQL port (default: `3306`) |
| `DB_NAME` | **Yes** | Database name (e.g. `vyno`) |
| `DB_USER` | **Yes** | MySQL user |
| `DB_PASSWORD` | No | MySQL password |
| `CF_ACCOUNT_ID` | **Yes** | Cloudflare account ID |
| `CF_AI_TOKEN` | **Yes** | Cloudflare AI API token |
| `CF_AI_MODEL` | **Yes** | Cloudflare AI model path (main generation model) |
| `CF_LLAMA_MODEL` | No | Llama model for prompt rewriting (default: `@cf/meta/llama-3.1-8b-instruct`) |
| `FFMPEG_PATH` | **Yes** | **Absolute path** to `ffmpeg` binary |
| `PROJECTS_BASE_PATH` | No | Where projects are stored (default: `./projects`) |
| `BASE_ASSETS_PATH` | No | Path to audio assets library (default: `../tools/assets`) |
| `GEMINI_API_KEY` | No | Google Gemini key for image analysis (recommended) |

---

## Contributing & Bug Reports

Vyno is **actively in development**. You may encounter bugs, incomplete features, or security issues.

If you find a bug or a security vulnerability, **please do not hesitate to open an issue** or contact directly:

- 🐛 **Bug reports:** [Open an issue](https://github.com/Onestepcom00/vyno-ai/issues)
- 🔒 **Security vulnerabilities:** Please report privately via email or GitHub private disclosure

All contributions (bug fixes, features, documentation, model integrations) are welcome. Fork the repo and open a pull request.

---

## Support the Project

Vyno is a free, open-source project built independently. If you find it useful and want to encourage its development:

**[☕ Support Vyno via donation](https://onemarket.mychariow.shop/donation-projects)**

Every contribution helps dedicate more time to features like MCP tool integrations, audio support, and model improvements.

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">
  <sub>Built with HyperFrames · Cloudflare AI · GSAP · React · Node.js</sub>
</div>
