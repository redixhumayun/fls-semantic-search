"""Development server for the FLS semantic search UI.

Crawls Google Drive on startup, loads experiment embeddings into memory,
and serves two endpoints for the Vite dev server to proxy:
  GET  /api/experiments  — returns the full in-memory index as JSON
  POST /api/embed        — accepts {"text": "..."} and returns {"embedding": [...]}
"""

import json
import os
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import TypedDict

from flask import Flask, jsonify, request, Response
from flask_cors import CORS

from .config import EXPERIMENTS_PREFIX_DEFAULT
from .crawler import find_experiments
from .embedder import Embedder
from .models import ExperimentListing
from .storage import DriveStorage


class EmbeddingItemRecord(TypedDict):
    id: str
    modality: str          # "text" | "image"
    timestamp: str         # ISO 8601
    source_path: str       # relative path within the experiment folder
    text_summary: str
    embedding: list[float] # 512-d L2-normalised CLIP vector, or [] if not yet generated


class ExperimentRecord(TypedDict):
    experiment_path: str   # e.g. "fls-experiments/2026-04-23/14-35-14_interaction"
    metadata: dict         # parsed metadata.json: experiment_name, date, timestamp, type, notes
    items: list[EmbeddingItemRecord]


class ExperimentsIndex(TypedDict):
    generated_at: str              # ISO 8601 timestamp of when the index was built
    experiments: list[ExperimentRecord]


app = Flask(__name__)
CORS(app)

_index: ExperimentsIndex = {"generated_at": "", "experiments": []}
_image_ids: dict[str, str] = {}   # full drive path → Drive file ID
_embedder: Embedder | None = None
_loading: bool = True
_load_error: str | None = None


def _build_index(storage: DriveStorage, prefix: str) -> None:
    global _index, _image_ids, _loading, _load_error
    try:
        print("Scanning Drive for experiments...")
        to_process, already_fresh, crawl_errors = find_experiments(
            storage, prefix, force=False
        )
        for path, msg in crawl_errors:
            print(f"  Warning: {path}: {msg}", file=sys.stderr)

        all_listings = to_process + already_fresh

        def _load_one(listing: "ExperimentListing") -> tuple[ExperimentRecord, dict[str, str]]:
            items: list[EmbeddingItemRecord] = []
            image_ids: dict[str, str] = {}
            if "embeddings.json" in listing.files:
                # Each thread gets its own DriveStorage instance since httplib2
                # (used internally by the Google API client) is not thread-safe.
                thread_storage = DriveStorage.from_env()
                try:
                    raw = thread_storage.download_file(listing.files["embeddings.json"])
                    items = json.loads(raw).get("items", [])

                    has_images = any(i.get("modality") == "image" for i in items)
                    if has_images:
                        for child in thread_storage.list_folder(listing.folder_id):
                            if (child["name"] == "snapshots"
                                    and child["mimeType"] == "application/vnd.google-apps.folder"):
                                for f in thread_storage.list_folder(child["id"]):
                                    if f["mimeType"] != "application/vnd.google-apps.folder":
                                        key = f"{listing.drive_path}/snapshots/{f['name']}"
                                        image_ids[key] = f["id"]
                                break
                except Exception as e:
                    print(
                        f"  Warning: could not load embeddings for {listing.drive_path}: {e}",
                        file=sys.stderr,
                    )
            return (
                ExperimentRecord(
                    experiment_path=listing.drive_path,
                    metadata=listing.metadata,
                    items=items,
                ),
                image_ids,
            )

        experiments: list[ExperimentRecord] = []
        collected_image_ids: dict[str, str] = {}
        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = {pool.submit(_load_one, listing): listing for listing in all_listings}
            for future in as_completed(futures):
                try:
                    record, ids = future.result()
                    experiments.append(record)
                    collected_image_ids.update(ids)
                except Exception as e:
                    listing = futures[future]
                    print(f"  Warning: failed to load {listing.drive_path}: {e}", file=sys.stderr)

        _index = ExperimentsIndex(
            generated_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            experiments=experiments,
        )
        _image_ids = collected_image_ids
        print(f"Index ready: {len(experiments)} experiment(s) loaded.")
    except Exception as e:
        _load_error = str(e)
        print(f"Error building index: {e}", file=sys.stderr)
    finally:
        _loading = False


@app.get("/api/experiments")
def get_experiments():
    if _loading:
        return jsonify({"loading": True, "experiments": []}), 202
    if _load_error:
        return jsonify({"error": _load_error}), 500
    return jsonify(_index)


@app.post("/api/embed")
def embed():
    if _embedder is None:
        return jsonify({"error": "embedder not loaded — start server without --no-embed"}), 503
    data = request.get_json(silent=True)
    if not data or "text" not in data:
        return jsonify({"error": "request body must be JSON with a 'text' field"}), 400
    embedding: list[float] = _embedder.embed_text(data["text"])
    return jsonify({"embedding": embedding})


@app.get("/api/image")
def get_image():
    path = request.args.get("path", "")
    if not path:
        return jsonify({"error": "path parameter required"}), 400
    file_id = _image_ids.get(path)
    if not file_id:
        return jsonify({"error": "image not found"}), 404
    try:
        img_storage = DriveStorage.from_env()
        data = img_storage.download_file(file_id)
        mime = "image/jpeg" if path.lower().endswith((".jpg", ".jpeg")) else "image/png"
        return Response(data, mimetype=mime)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.get("/api/status")
def status():
    return jsonify({"loading": _loading, "error": _load_error})


def cli() -> None:
    """Entry point for the fls-server command."""
    import argparse

    global _embedder

    parser = argparse.ArgumentParser(
        description="FLS semantic search development server."
    )
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument(
        "--no-embed",
        action="store_true",
        help="Skip loading the CLIP model. Search falls back to keyword matching.",
    )
    args = parser.parse_args()

    try:
        storage = DriveStorage.from_env()
    except RuntimeError as e:
        sys.exit(f"Error: {e}")

    prefix = os.environ.get("GDRIVE_EXPERIMENTS_PREFIX", EXPERIMENTS_PREFIX_DEFAULT)

    if not args.no_embed:
        _embedder = Embedder()

    threading.Thread(
        target=_build_index, args=(storage, prefix), daemon=True
    ).start()

    print(f"FLS server running at http://localhost:{args.port}")
    app.run(host="localhost", port=args.port, debug=False)
