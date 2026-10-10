# La IA local

A smart helper that lives inside your web browser.

## What is this? (explained like you're 5)

Imagine a little robot helper. 🤖

The first time you visit, the robot moves into your computer. It's like bringing a new toy home from the store. After that, it stays with you.

Because the robot lives **on your computer**, your papers never leave your house. Nobody else gets to see them.

The robot knows three tricks:

1. **Translate** 🗣️: You write something in English and it says it in Spanish. Or the other way around.
2. **Hide secrets in a PDF** 🙈: You give it a document. It finds private things like names, phone numbers, emails, Social Security numbers and immigration numbers, and covers them with black boxes.
3. **Ask a document** ❓: You give it a PDF and ask a question like "When is my deposit due?" It reads the PDF and tells you the answer.

There's also a button that switches the app's own words between **English** and **Español**.

## What your computer needs

- A recent **Chrome** or **Edge** browser. *Hide secrets* and *Ask a document* need **WebGPU**.
- Free disk space for the robot's brain:
  - Translate: about **240 MB** (Opus-MT). If Chrome has its built-in Translator, it uses that instead.
  - Hide secrets and Ask a document: about **1 GB**. Both tricks share the same Qwen3-1.7B model, so it only downloads once.
- About **2 GB of GPU memory** while the big model runs.

You don't have to guess. The app has a **Device check** panel that tells you what your computer supports.

## Run it locally

1. **Install Node.js 22.21.1**. The version is pinned in `.nvmrc`.
   ```bash
   nvm install
   nvm use
   ```
2. **Get the code**
   ```bash
   git clone git@github.com:dbpb0214/la-ia-local.git
   cd la-ia-local
   ```
3. **Install dependencies**
   ```bash
   npm install
   ```
4. **Start the dev server**
   ```bash
   npm run dev
   ```
5. **Open the URL that Vite prints** (usually http://localhost:5173) in Chrome.
6. **Pick a tool, then click Download.** The first download takes a while. After that the model is cached in your browser and loads fast.

> **Tip:** Tick **"Use mock engine (UI test)"** to try the UI without downloading any models.

You don't need a `.env` file for local development.

## Commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the dev server |
| `npm run build` | Build for production into `dist/` |
| `npm run preview` | Preview the production build |
| `node src/anonymize/check.mjs` | Self-check the PII detection rules |
| `node src/qa/check.mjs` | Self-check Q&A document retrieval |

## Project map

```
src/
├── App.jsx          # Main page: tool picker, download, panels
├── engines/         # Tool registry (MODELS) + engine contract
├── translation/     # EN↔ES: Chrome Translator, else Opus-MT in a worker
├── anonymize/       # PII rules + LLM detection + PDF redaction
├── qa/              # PDF chunking/retrieval + answering
├── llm/             # Shared Qwen3-1.7B (WebLLM) worker
├── components/      # UI panels (DeviceCheck, DownloadPanel, ...)
└── lib/             # Helpers (load state machine, formatting)
base44/              # Base44 project config
```

## Deploy (Base44 CLI)

```bash
base44 login    # Authenticate
base44 deploy   # Deploy backend + hosting
```
