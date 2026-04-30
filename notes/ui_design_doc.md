# FLS Semantic Search — UI Design

## Stack

| Layer | Choice |
|---|---|
| Framework | React + Vite + TypeScript |
| Styling | Tailwind CSS v4 |
| Icons | lucide-react |
| Routing | React Router DOM v7 |
| CLIP inference | `fls-server` Python server — reuses locally cached model |
| Search | Cosine similarity in JS (browser-side, against in-memory index) |
| Data | Served live from `fls-server` via `/api/experiments` |

## How It Works

### Data flow

1. Researcher runs `fls-embed` to ensure all experiments have embeddings in Drive.
2. Researcher starts `fls-server`, which authenticates with Drive, crawls all experiments, and loads their `embeddings.json` into memory.
3. On load, the React app fetches `/api/experiments` from `fls-server` and holds the index in memory.

### Search flow

1. User types a natural-language query.
2. Browser sends the query to `POST /api/embed` on `fls-server`.
3. `fls-server` uses the CLIP model (already cached locally from `fls-embed`) to return a 512-d vector.
4. Browser computes cosine similarity against all items in the in-memory index.
5. Top-k results are displayed as experiment cards.

### Browse flow

A calendar view lets users drill down by date → experiment without typing a query. Backed by the same in-memory index.

## Running Locally

```bash
fls-embed            # ensure Drive embeddings are current
fls-server           # crawls Drive on startup, serves /api/* on port 8000
npm run dev          # Vite on port 5173, proxies /api/* to port 8000
```

## Migration to Hosted

When external access is needed:
- Replace Flask with FastAPI; `fls-server` becomes a proper FastAPI app.
- FastAPI also serves the built React bundle as static files.
- Swap Google OAuth flow for a service account or web app OAuth flow.
- No structural changes to the frontend.
