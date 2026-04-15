import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from .storage import R2Storage


def _generate_metadata(
    exp_path: Path,
    experiment_type: str,
    timestamp: datetime,
    notes: str,
) -> dict:
    return {
        "experiment_name": exp_path.name,
        "date": timestamp.strftime("%Y-%m-%d"),
        "timestamp": timestamp.isoformat(),
        "type": experiment_type,
        "notes": notes,
    }


def _r2_prefix(timestamp: datetime, experiment_type: str) -> str:
    return (
        f"fls-experiments"
        f"/{timestamp.strftime('%Y-%m-%d')}"
        f"/{timestamp.strftime('%H-%M-%S')}_{experiment_type}"
    )


def cli() -> None:
    parser = argparse.ArgumentParser(description="Upload an FLS experiment directory to R2.")
    parser.add_argument("--experiment", required=True, help="Path to the experiment directory.")
    parser.add_argument("--type", dest="experiment_type", required=True, choices=["interaction", "illumination"], help="Experiment type.")
    parser.add_argument("--notes", default="", help="Optional researcher notes.")
    args = parser.parse_args()

    exp_path = Path(args.experiment)
    if not exp_path.is_dir():
        print(f"Error: {exp_path} is not a directory.", file=sys.stderr)
        sys.exit(1)

    timestamp = datetime.now(timezone.utc)
    prefix = _r2_prefix(timestamp, args.experiment_type)

    storage = R2Storage.from_env()

    # Upload metadata.json (generated in memory — does not touch the source directory)
    metadata = _generate_metadata(exp_path, args.experiment_type, timestamp, args.notes)
    metadata_bytes = json.dumps(metadata, indent=2).encode()
    print(f"Uploading to {prefix}/")
    storage.upload_bytes(metadata_bytes, f"{prefix}/metadata.json", content_type="application/json")
    print("  metadata.json ✓")

    # Upload all files from the experiment directory, preserving structure
    files = sorted(f for f in exp_path.rglob("*") if f.is_file())
    if not files:
        print("  (no files found in experiment directory)", file=sys.stderr)
        return

    for file_path in files:
        relative = file_path.relative_to(exp_path)
        r2_key = f"{prefix}/{relative}"
        print(f"  {relative} ✓")
        storage.upload_file(file_path, r2_key)

    print(f"\nDone. {len(files) + 1} file(s) stored at: {prefix}")
