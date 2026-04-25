import argparse
import io
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from googleapiclient.errors import HttpError

from .crawler import ExperimentListing, PIPELINE_VERSIONS, find_experiments
from .embedder import Embedder
from .models import EmbeddingItem
from .parser import parse_illumination, parse_interaction
from .snapshot import extract_snapshots
from .storage import DriveStorage
from .summarize import summarize_illumination, summarize_interaction

_DEFAULT_ERROR_LOG = Path.home() / ".config" / "fls" / "embed_errors.log"
_DEFAULT_EXPERIMENTS_PREFIX = "fls-experiments"

_SNAPSHOT_LABEL = {
    "snapshot_first":    "first frame",
    "snapshot_middle_1": "middle frame 1",
    "snapshot_middle_2": "middle frame 2",
    "snapshot_middle_3": "middle frame 3",
    "snapshot_last":     "last frame",
}


def _log_error(log_path: Path, experiment_path: str, error_type: str, message: str) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    entry = json.dumps({
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "experiment_path": experiment_path,
        "error_type": error_type,
        "message": message,
    })
    with log_path.open("a") as fh:
        fh.write(entry + "\n")


def _offset_to_iso(base_timestamp: str, offset_s: float) -> str:
    dt = datetime.fromisoformat(base_timestamp)
    return (dt + timedelta(seconds=offset_s)).isoformat().replace("+00:00", "Z")


def _process_experiment(
    storage: DriveStorage,
    listing: ExperimentListing,
    embedder: Embedder | None,
    dry_run: bool,
) -> None:
    """Embed a single experiment and write outputs back to Drive.

    Args:
        storage: Authenticated DriveStorage instance.
        listing: Experiment metadata and file map from the crawler.
        embedder: Loaded Embedder instance, or None during dry-run.
        dry_run: When True, parse and print only — no Drive writes.

    Raises:
        ValueError: On malformed experiment data.
        HttpError: On Drive API failures.
    """
    exp_type = listing.metadata.get("type")
    download_fn = storage.download_file
    exp_timestamp = listing.metadata.get("timestamp", datetime.now(timezone.utc).isoformat())

    if exp_type == "illumination":
        data = parse_illumination(listing.files, download_fn)
        summary = summarize_illumination(data)
        has_video = data.has_video
    elif exp_type == "interaction":
        data = parse_interaction(listing.files, download_fn)
        summary = summarize_interaction(data)
        has_video = data.has_video
    else:
        raise ValueError(f"Unknown experiment type: {exp_type!r}")

    if dry_run:
        print(f"  type:      {exp_type}")
        print(f"  summary:   {summary}")
        print(f"  has_video: {has_video}")
        return

    text_embedding = embedder.embed_text(summary)
    items: list[EmbeddingItem] = [
        EmbeddingItem(
            id="experiment_text",
            modality="text",
            timestamp=exp_timestamp,
            source_path="metadata.json",
            text_summary=summary,
            embedding=text_embedding,
        )
    ]

    if has_video:
        mp4_name = next(n for n in listing.files if n.endswith(".mp4"))
        print(f"  Downloading video ({mp4_name})...")
        mp4_bytes = storage.download_file(listing.files[mp4_name])
        print(f"  Extracting snapshots...")
        snapshots = extract_snapshots(mp4_bytes)

        for snap in snapshots:
            label = _SNAPSHOT_LABEL.get(snap.id, snap.id)
            snap_summary = f"{summary}, representative {label} snapshot"
            image_embedding = embedder.embed_image(snap.image)

            jpeg_buf = io.BytesIO()
            snap.image.save(jpeg_buf, format="JPEG", quality=85)
            storage.upload_bytes(
                jpeg_buf.getvalue(),
                f"{listing.drive_path}/{snap.path}",
                "image/jpeg",
            )
            print(f"  Uploaded {snap.path}")

            items.append(EmbeddingItem(
                id=snap.id,
                modality="image",
                timestamp=_offset_to_iso(exp_timestamp, snap.offset_seconds),
                source_path=snap.path,
                text_summary=snap_summary,
                embedding=image_embedding,
            ))

    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    embeddings_doc = {
        **PIPELINE_VERSIONS,
        "generated_at": now,
        "experiment_path": listing.drive_path,
        "items": [
            {
                "id": item.id,
                "modality": item.modality,
                "timestamp": item.timestamp,
                "source_path": item.source_path,
                "text_summary": item.text_summary,
                "embedding": item.embedding,
            }
            for item in items
        ],
    }
    storage.upload_bytes(
        json.dumps(embeddings_doc, indent=2).encode(),
        f"{listing.drive_path}/embeddings.json",
        "application/json",
    )
    print(f"  Uploaded embeddings.json ({len(items)} item(s))")


def cli() -> None:
    """Entry point for the fls-embed command."""
    parser = argparse.ArgumentParser(
        description="Generate CLIP embeddings for FLS experiments stored in Google Drive."
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Regenerate embeddings even if they are already current.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would be processed without writing anything to Drive.",
    )
    parser.add_argument(
        "--log-path",
        default=str(_DEFAULT_ERROR_LOG),
        help="Path for the error log file (JSON lines). Default: ~/.config/fls/embed_errors.log",
    )
    args = parser.parse_args()

    experiments_prefix = os.environ.get("GDRIVE_EXPERIMENTS_PREFIX", _DEFAULT_EXPERIMENTS_PREFIX)
    log_path = Path(args.log_path)

    try:
        storage = DriveStorage.from_env()
    except RuntimeError as e:
        sys.exit(f"Error: {e}")

    print(f"Scanning {experiments_prefix!r} in Google Drive...")
    to_process, already_fresh, crawl_errors = find_experiments(storage, experiments_prefix, force=args.force)

    for drive_path, message in crawl_errors:
        print(f"  Crawl error: {message}", file=sys.stderr)
        _log_error(log_path, drive_path, "CrawlError", message)

    print(f"Found {len(to_process)} experiment(s) to embed, {len(already_fresh)} already current.")

    if not to_process:
        print("Nothing to do.")
        return

    embedder: Embedder | None = None
    if not args.dry_run:
        embedder = Embedder()

    processed = 0
    errors = 0

    for listing in to_process:
        print(f"\nProcessing: {listing.drive_path}")
        try:
            _process_experiment(storage, listing, embedder, dry_run=args.dry_run)
            processed += 1
        except (ValueError, HttpError) as e:
            print(f"  Error: {e}", file=sys.stderr)
            _log_error(log_path, listing.drive_path, type(e).__name__, str(e))
            errors += 1

    print(
        f"\nSummary: {processed} processed, "
        f"{len(already_fresh)} skipped (fresh), "
        f"{errors} error(s)."
    )
    if errors:
        print(f"Error details: {log_path}")
