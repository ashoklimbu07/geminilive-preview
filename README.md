# Gemini Live Voice Assistant

React + Vite app integrating Gemini Live for real-time voice conversation, paired with an LLM-driven planning flow.

## Status

- **Tested** -> Gemini Live voice model (real-time voice session via `useGeminiLive`)
- **Integrated LLM** -> Master prompt used to break down tasks into a plan (`masterPrompt.js` + `task-chunking-master-prompt.json`)

## Folder Structure

```
geminitest/
├── public/                        # Static assets served as-is
│   ├── favicon.svg
│   ├── icon.svg / icon-maskable.svg / icons.svg
│   ├── manifest.webmanifest        # PWA manifest
│   └── sw.js                       # Service worker
├── src/
│   ├── assets/                     # Images used in the app
│   │   ├── hero.png
│   │   ├── react.svg
│   │   └── vite.svg
│   ├── hooks/
│   │   ├── useGeminiLive.js        # Gemini Live voice session hook
│   │   ├── usePlanner.js           # Task planning/LLM hook
│   │   └── useSessions.js          # Session state/management hook
│   ├── App.jsx                     # Root app component
│   ├── BrainThinking.jsx           # "Thinking" state UI
│   ├── ConversationView.jsx        # Voice conversation UI
│   ├── NavBar.jsx                  # Navigation bar
│   ├── PlanView.jsx                # Task plan display
│   ├── TodayView.jsx               # Today's tasks view
│   ├── apiKeys.js                  # API key pool/rotation logic
│   ├── audio.js                    # Audio capture/playback utilities
│   ├── devLogger.js                # Dev-only logging helper
│   ├── index.css                   # Global styles (Tailwind)
│   ├── main.jsx                    # App entry point
│   └── masterPrompt.js             # Master prompt to break down tasks
├── task-chunking-master-prompt.json # Master prompt source/config for task chunking
├── index.html                      # Vite HTML entry
├── vite.config.js                  # Vite config
├── .env.example                    # Env var template
├── package.json
└── README.md
```

## Getting Started

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and fill in the required API keys before running.

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — production build
- `npm run preview` — preview the production build
- `npm run lint` — run oxlint
