# FLS Semantic Search — Requirements

## Goal

Build a first version of a semantic search layer over FLS experiment data so researchers can browse experiments, inspect representative snapshots, and query experiment metadata using natural language.

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
Provides a calendar/drilldown view and natural-language query interface over experiments and representative snapshots.

---

## Data Flow

1. Experiment runs and produces telemetry logs and, when available, video on the orchestrator.
2. Researcher runs `fls-upload --experiment <path>`.
3. Server stores raw data in R2.
4. Server derives experiment metadata, selects representative snapshots, and generates embeddings.
5. Researcher queries results through the frontend.

---

## Key Decisions

- Storage: Cloudflare R2 for low-cost persistence
- Embeddings: CLIP, using representative images and text representations of metadata
- Frontend: Streamlit
- LLM layer: DSPy with a local default model and optional BYOK API support
- V1 scope: simple and fast to deploy, with a modular design so components like CLIP can be swapped later

---

## Open Questions

1. What metadata should be attached to each representative snapshot?
   Reason: the professor suggested using experiment type, duration, number of FLSs, illumination shape, interaction type, and 5 representative images. The exact snapshot-level metadata will determine what the first version can query.
2. How should the 3 in-between images be selected and recorded?
   Reason: take-off and landing are fixed, but the 3 intermediate images must be chosen and stored as part of the experiment metadata so the selection is reproducible and can be refined later.
