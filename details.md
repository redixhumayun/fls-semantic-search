# FLS Semantic Search — Detailed Design

## Goal

Build a semantic search layer over FLS experiment data. Enable researchers to query frame + telemetry data using natural language, and discover cross-modal relationships between visual and telemetry data.

---

## Architecture

```
┌─────────────┐    ┌───────────────┐    ┌─────────────┐
│  Camera +   │    │  Client CLI   │    │             │
│   Drones    │───▶│ (orchestrator)│───▶│   Server    │
└─────────────┘    └───────────────┘    │             │
                                         └─────────────┘
                                               │
                    ┌──────────────────────────┘
                    │
                    ▼
            ┌───────────────────┐
            │  Cloudflare R2    │
            │  (persistence)    │
            └───────────────────┘
                    │
                    ▼
            ┌───────────────────┐
            │ Embedding Pipeline │
            │   (on server)     │
            └───────────────────┘
                    │
                    ▼
            ┌───────────────────┐
            │    Frontend       │
            │   (Streamlit)     │
            └───────────────────┘
                    │
                    ▼
            ┌───────────────────┐
            │    LLM Query      │
            └───────────────────┘
```

---

## Components

### Client CLI Tool
- Runs on orchestrator laptop and uploads an already-written experiment directory to server using `fls-upload --experiment <path>`.
- Generates `metadata.json` from the directory name and CLI flags such as `--type` and `--notes`, with retry logic for network interruptions.

### Server
- Receives uploaded experiments, persists raw data to R2, triggers embedding generation, and serves the frontend/query interface.

### Upload Format
- Client uploads one experiment as a zipped directory containing `frames/`, `telemetry/`, and generated `metadata.json`.
- Generated metadata includes experiment name, timestamp, type, and optional notes.
- Suggested upload API: `POST /experiments`.

### Embedding Pipeline
- Runs on the server after upload, reads raw data from R2, generates frame and telemetry embeddings, and writes `embeddings.json` back to R2.

### Frontend
- Streamlit app with a calendar/drilldown view and a natural-language query interface.
- Uses generated embeddings to retrieve top-k matches and can optionally ask an LLM to summarize the results.

---

## Data Flow

1. Experiment runs → camera captures frames, drones emit telemetry
2. Researcher runs `fls-upload` → data sent to server
3. Server writes raw data to R2
4. Server triggers embedding pipeline → embeddings generated
5. Researcher queries via frontend → LLM returns results

---

## Data Types

| Type | Description |
|------|-------------|
| Frame data | Video frames from camera |
| Telemetry | Drone state data (position, velocity, etc.) |
| Experiment metadata | Name, type (interaction / illumination), date, researcher notes |

---

## Storage Structure (R2)

```
fls-experiments/
└── 2025-04-09/
    └── 10-30-00_interaction/
        ├── frames/
        │   └── frame_001.jpg
        ├── telemetry/
        │   └── drone_001.json
        └── embeddings.json
```

**Storage:** Cloudflare R2 — 10 GB-month/month free, unlimited downloads, S3-compatible API. No egress fees.

*Storage estimate per experiment:*
- *Raw data: ~50MB*
- *Embeddings (CLIP, 512 dimensions): ~5MB*
- *Total: ~55MB/experiment*
- *10GB free tier ≈ ~175 experiments before hitting limit*

*Alternatives considered:*
- *GitHub LFS: 1GB storage + 1GB/month bandwidth — insufficient for research workloads*
- *Google Drive - API painful to deal with*
- *S3: cost concern per professor*

---

## Embedding Strategy

- **CLIP** for both frames and telemetry — single model, same vector space
- Chosen because it embeds images and text into the same vector space, enabling cross-modal retrieval
- Frames: CLIP image encoder
- Telemetry: JSON converted to structured text → CLIP text encoder
- Frame policy: embed every frame
- Cross-modal retrieval: query frames by telemetry anomaly, or vice versa

### `embeddings.json`

Per-experiment embedding output stored alongside raw data in R2.

Example structure:

```json
[
  {
    "id": "frame_001",
    "modality": "frame",
    "timestamp": "2025-04-09T10:30:01Z",
    "source_path": "frames/frame_001.jpg",
    "text_summary": "frame at t=1s",
    "embedding": [0.12, -0.44, 0.03]
  },
  {
    "id": "telemetry_001",
    "modality": "telemetry",
    "timestamp": "2025-04-09T10:30:01Z",
    "source_path": "telemetry/drone_001.json",
    "text_summary": "Position x=1.2 y=3.4 z=5.6. Thrust 0.8.",
    "embedding": [0.09, -0.21, 0.18]
  }
]
```

---

## Experiment Types

- **Interaction** — user interacts with FLSs
- **Illumination** — FLSs render shapes

Both produce identical data structures; only metadata differs.

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Client CLI tool | Python |
| Server | FastAPI |
| Embedding model | CLIP (handles both images + text in same vector space) |
| Storage | Cloudflare R2 (S3-compatible) |
| Embeddings | Generated on server |
| Frontend | Streamlit |
| LLM | DSPy with local default model (for example Qwen) and optional BYOK OpenAI-compatible API |

---

## Open Questions

1. Where does the server run — researcher's machine, cloud VM, lab server?
2. Telemetry → text conversion format — what schema?
   - Per-reading template: one embedding per telemetry record
   - Fixed-window summary: summarize a time window (for example 1 second)
   - Event-based summary: summarize detected anomalies or transitions
   - Hybrid: store both detailed and summarized telemetry text
   - Which fields to include (position, velocity, thrust, timestamp)?
