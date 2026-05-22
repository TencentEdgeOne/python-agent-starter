# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Python LLM Agent running on EdgeOne Pages Functions. The backend uses raw `httpx` streaming to call an OpenAI-compatible API with tool calling support (EdgeOne sandbox tools: commands, files, code_interpreter, browser). The frontend is a React chat UI with a CRT-style code viewer panel.

## Commands

```bash
# Frontend
npm install              # Install frontend deps
npm run dev              # Vite dev server at localhost:5173 (proxies /chat → localhost:8088)
npm run build            # tsc + vite build → dist/
npx tsc --noEmit        # Type-check only (no output)

# Backend
pip install -r requirements.txt   # Install Python deps
npx edgeone-cli dev               # Start EdgeOne dev server at localhost:8088

# Full local dev: run backend + frontend in separate terminals
```

## Architecture

### Two-Layer Split

- **`agents/`** — Python backend (EdgeOne Pages Functions). File path determines route:
  - `agents/chat/index.py` → `POST /chat` (main SSE streaming handler)
  - `agents/chat/stop.py` → `POST /chat/stop` (abort active run)
  - `agents/history/index.py` → `POST /history` (restore chat after refresh)
  - Files prefixed with `_` are private modules (not mapped to routes)

- **`src/`** — React frontend (Vite + TypeScript + CSS Modules)

### Backend Flow (agents/)

The handler in `agents/chat/index.py` implements a multi-round tool calling loop:

1. **ChatSession** (`_session.py`) wraps `context.store` to read/write conversation history
2. **build_tools** (`_tools.py`) extracts EdgeOne platform tools from `context.tools` and converts them to OpenAI function calling schema
3. **httpx streaming** calls the LLM at `MODEL_CONFIG['base_url']/chat/completions`
4. **Tool loop** (up to `MAX_TOOL_ROUNDS=10`): if LLM returns `tool_calls`, execute them via `tool_registry.execute()`, append results, and re-request
5. SSE events are yielded: `text_delta`, `tool_called`, `done`, `error`, `ping`

Key platform objects available in handlers:
- `context.store` — persistent message storage (ConversationMemory)
- `context.tools` — EdgeOne sandbox tool handles
- `context.request.signal` — asyncio.Event for cancel detection
- `context.conversation_id` / `context.run_id`
- `context.utils.abort_active_run(cid)` — cancel a running conversation

### Frontend Structure (src/)

- `App.tsx` — orchestrates chat + code viewer panels, manages SSE stream via `api.ts`
- `api.ts` — `sendMessageStream()` handles SSE parsing, dispatches callbacks: `onTextDelta`, `onToolCalled`, `onDone`, `onError`
- `components/CodeViewer.tsx` — static display-only code panel (amber CRT aesthetic) showing the agent flow
- `components/ToolLamp.tsx` — animated tool indicators that flash when LLM calls a tool

### Important Conventions

- The `pages-agent-conversation-id` HTTP header identifies conversations. The `/chat/stop` endpoint must NOT use this header (passes target via body instead).
- `context.store` uses `append_message(cid, role, content)` and `get_messages(cid, limit, order)`.
- `_model.py` fixes SSL globally for the process (macOS cert issues) and exports `MODEL_CONFIG` dict and `ssl_verify`.
- The `.edgeone/` directory contains the platform runtime adapter — generally don't modify these files.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `AI_GATEWAY_API_KEY` | LLM API key |
| `AI_GATEWAY_BASE_URL` | LLM API base URL (OpenAI-compatible) |
| `AI_GATEWAY_MODEL` | Model identifier (default: `hy3-preview`) |

Configured in `.env` (copy from `.env.example`).
