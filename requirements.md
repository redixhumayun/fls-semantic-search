# FLS Semantic Search — Requirements

## Goal

Build a semantic search layer over FLS experiment data so researchers can query video frames and drone telemetry using natural language and discover semantic relationships between them.

---

## Architecture

```
Camera + Drones -> Client CLI -> Server -> R2
                                     |
                                     v
                              Embedding Pipeline
                                     |
                                     v
                               Frontend + LLM
```

---

## Components

### Client
Python CLI run on the orchestrator laptop. It uploads an already-written experiment directory to the server and generates metadata from the directory name and CLI flags.

### Server
Receives uploaded experiments, persists raw data to R2, triggers embedding generation, and serves the frontend/query interface.

### Frontend
Provides a calendar/drilldown view and natural-language query interface over generated embeddings.

---

## Data Flow

1. Experiment runs and produces frames + telemetry on the orchestrator.
2. Researcher runs `fls-upload --experiment <path>`.
3. Server stores raw data in R2.
4. Server generates embeddings for frames and telemetry.
5. Researcher queries results through the frontend.

---

## Key Decisions

- Storage: Cloudflare R2 for low-cost persistence
- Embeddings: CLIP, using images for frames and text representations for telemetry
- Frontend: Streamlit
- LLM layer: DSPy with a local default model and optional BYOK API support

---

## Open Questions

1. Where should the server run?
   Reason: the server is responsible for receiving uploads, persisting data, running embedding generation, and serving the UI. If it also runs a local model, it needs enough compute for that.
2. How should telemetry be converted to text before embedding?
   Reason: CLIP can embed images and text, but not raw telemetry JSON. This choice directly affects embedding quality and what kinds of semantic queries the system can support.
