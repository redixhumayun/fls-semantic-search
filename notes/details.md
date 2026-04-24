# FLS Semantic Search — Detailed Design

---

## V0 — Updated Scope (Post-Professor Meeting, April 14 2026)

Figma design: https://www.figma.com/design/HQvMkRskCm7n6ypPSRpoLM

**Primary users:** Researchers, NSF sponsors, global researchers, high school students. Interface must be intuitive for non-technical audiences.

**Write path:** Skip embedding generation on upload for now. Client just dumps raw experiment data into Google Drive. Embeddings can be generated separately.

**Storage:** Structured metadata paths in Google Drive (directory structure as defined below remains correct).

**Client:** Single self-contained Python module — not a multi-package library.

---

## Goal

Build a first version of a semantic search layer over FLS experiment data. The initial system should be simple and quick to deploy: it will index experiment metadata plus a small set of representative images and support iteration later.

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
            │   Google Drive    │
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
- Runs on the researcher's laptop.
- Receives uploaded experiments, persists raw data to Google Drive, triggers embedding generation, and serves the frontend/query interface.

### Upload Format
- Client uploads one experiment as a zipped directory containing generated `metadata.json`, one or more telemetry log files, and video or extracted frames when available.
- Generated metadata includes experiment name, timestamp, type, and optional notes.
- Suggested upload API: `POST /experiments`.

### Embedding Pipeline
- Runs on the server after upload.
- Reads raw data from Google Drive, derives experiment metadata, selects representative snapshots, and generates embeddings.
- V1 scope: use take-off, landing, and 3 randomly selected in-between images when video is present.
- Support the case where video is absent.

### Frontend
- Streamlit app with a calendar/drilldown view and a natural-language query interface.
- Uses generated embeddings to retrieve top-k matches and can optionally ask an LLM to summarize the results.
- Intended audience includes both FLS team members and project sponsors, so the interface should be intuitive and visually polished.

---

## Data Flow

1. Experiment runs → orchestrator stores telemetry logs and, when available, video
2. Researcher runs `fls-upload` → data sent to server
3. Server writes raw data to Google Drive
4. Server derives metadata, selects representative snapshots, and generates embeddings
5. Researcher queries via frontend → LLM returns results

---

## Data Types

| Type | Description |
|------|-------------|
| Video / frame data | Optional. Some experiments may have video; rare cases may not. |
| Telemetry logs | One or more per-FLS log files per experiment |
| Experiment metadata | Name, type (interaction / illumination), date, researcher notes |
| Snapshot metadata | Metadata attached to representative images used in V1 search |

---

## Storage Structure (Google Drive)

```
fls-experiments/
└── 2025-04-09/
    └── 10-30-00_interaction/
        ├── metadata.json
        ├── logs/
        │   ├── fls_001.log
        │   ├── fls_002.log
        │   └── fls_003.log
        ├── video.mp4
        ├── snapshots/
        │   ├── takeoff.jpg
        │   ├── middle_1.jpg
        │   ├── middle_2.jpg
        │   ├── middle_3.jpg
        │   └── landing.jpg
        └── embeddings.json
```

**Storage:** Google Drive shared folder configured via `GDRIVE_FOLDER_ID`.

*Storage estimate per experiment:*
- *Raw data: approximately 50MB based on the professor's estimate*
- *V1 embeddings are smaller than the original full-stream design because only metadata and representative snapshots are embedded*
- *10GB free tier is sufficient for the initial prototype scale*

*Why Google Drive for now:*
- *Already used by the upload CLI and lab workflow*
- *Shared folder access matches the current research setup*
- *Keeps storage simple while the embedding pipeline is still evolving*

---

## Embedding Strategy

- **CLIP** for representative images and text metadata — single model, same vector space
- Chosen because it embeds images and text into the same vector space, enabling cross-modal retrieval
- Representative images: take-off, landing, and 3 random in-between images
- Text side: experiment metadata plus metadata associated with a selected snapshot
- V1 focuses on experiment/snapshot-level retrieval, not full time-series correlation

### `embeddings.json`

Per-experiment embedding output stored alongside raw data in Google Drive.

Example structure:

```json
[
  {
    "id": "snapshot_middle_1",
    "modality": "image",
    "timestamp": "2025-04-09T10:30:01Z",
    "source_path": "snapshots/middle_1.jpg",
    "text_summary": "illumination experiment, 25 FLSs, shape=rose, representative middle snapshot",
    "embedding": [0.12, -0.44, 0.03]
  },
  {
    "id": "experiment_metadata",
    "modality": "text",
    "timestamp": "2025-04-09T10:30:00Z",
    "source_path": "metadata.json",
    "text_summary": "interaction experiment, duration 60s, 12 FLSs, interaction type touch",
    "embedding": [0.09, -0.21, 0.18]
  }
]
```

---

## Experiment Types

- **Interaction** — user interacts with FLSs
- **Illumination** — FLSs render shapes

Both produce identical data structures; only metadata differs.

For illumination experiments, there may be multiple telemetry log files corresponding to different FLSs. Video may also be absent in rare cases.

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Client CLI tool | Python |
| Server | FastAPI |
| Embedding model | CLIP (handles both images + text in same vector space) |
| Storage | Google Drive |
| Embeddings | Generated via separate `fls-embed` script, run manually by researchers after a session |
| Frontend | React |
| LLM | DSPy with local default model (for example Qwen) and optional BYOK OpenAI-compatible API |

---

## Open Questions

1. What metadata should be attached to each representative snapshot?
   - Candidate fields from the professor: experiment type, duration, number of FLSs, illumination shape, interaction type
   - Need to decide which of these are experiment-level vs snapshot-level
2. How should the 3 in-between images be selected and recorded?
   - Random selection is acceptable for V1
   - The chosen images should be stored in metadata so the selection is reproducible and refinable later
3. What should the fallback behavior be when video is absent?
   - Metadata-only experiment card
   - Telemetry/log-only representation
