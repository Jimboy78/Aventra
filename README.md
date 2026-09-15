# Aventra

AI-powered interactive story generator with persistent memory.

Generates branching narrative with GPT-4.1 mini, illustrates scenes on demand with Gemini 2.5 Flash, and keeps characters, locations, and plot facts consistent across a session using a vector-backed memory layer (LangChain + ChromaDB).

## Stack

- **Backend:** FastAPI, LangChain, ChromaDB, GPT-4.1 mini, Gemini 2.5 Flash
- **Frontend:** Next.js, TypeScript, Vercel AI SDK, TailwindCSS

## Structure

- `backend/` — FastAPI service: session setup, story generation, image generation, save/load, debug/trace endpoints
- `frontend/` — Next.js app streaming story text via the Vercel AI SDK

## Run locally

Backend:

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # add OPENAI_API_KEY and GOOGLE_API_KEY
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend:

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

## Highlights

- Vector memory (ChromaDB) retrieved as context grows, instead of replaying full story history to the model
- Dual-model pipeline: text generation and image generation handled by separate specialized services
- Incremental state updates via JSON patches instead of full-state rewrites
- Debug/trace endpoints for inspecting prompts, model outputs, and state transitions during development
