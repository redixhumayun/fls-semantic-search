# FLS Semantic Search — UI Implementation Log

## Decisions

### Stack
- **Framework**: Vite + React + TypeScript
- **Styling**: Tailwind CSS v3 (v3 over v4 for ecosystem stability)
- **Icons**: lucide-react (no shadcn/ui — Tailwind alone is sufficient for this design)
- **Routing**: React Router DOM v6
- **Testing**: agent-browser (local dev dep)

### Data
- `embeddings_index.json` lives in `ui/public/` so Vite serves it as a static asset
- `fls-index` CLI (to be built) should write its output to `ui/public/embeddings_index.json`
- Mock data seeded in `ui/public/embeddings_index.json` for development

### Search
- Default: keyword search over `text_summary` fields (works without embed server)
- Enhanced: if `/embed` responds, use cosine similarity on stored embeddings
- Since embeddings are L2-normalised, dot product == cosine similarity
- Stored embeddings are empty `[]` in mock data — similarity falls back to text search automatically

### Snapshot images
- Snapshots are stored in Google Drive and require auth to access
- Detail view shows placeholders for now; real images require Drive auth (future work)

### AI Summary on Search Results
- No LLM call for now — summary is generated deterministically from result metadata
- Documents count, type breakdown, date range of results

### Proxy path
- All `/api/*` routes are proxied to `http://localhost:8000` — Vite handles everything else as static assets
- `/api/experiments` — returns the full in-memory index from `fls-server`
- `/api/embed` — returns a CLIP embedding for a query string
- `/api/status` — returns server loading state

### Data loading
- `IndexContext` polls `/api/experiments` every 2 seconds while the server returns `202 loading` (Drive crawl in progress), then stops once data is ready

### Routing structure
- `/` → Dashboard (calendar + recent)
- `/search?q=...&type=all` → Search Results
- `/experiment/*` → Experiment Detail (splat route handles slashes in path)

### Navigation
- Clicking a calendar day with experiments → `/search?date=YYYY-MM-DD`
- Clicking a recent experiment → `/experiment/:path`
- Clicking "View →" on a result card → `/experiment/:path`
- "← Search Results" breadcrumb → `history.back()`
