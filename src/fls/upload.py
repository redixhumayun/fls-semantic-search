import json
from datetime import datetime, timezone
from pathlib import Path

import click

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


@click.command()
@click.option(
    "--experiment",
    required=True,
    type=click.Path(exists=True, file_okay=False, path_type=Path),
    help="Path to the experiment directory.",
)
@click.option(
    "--type",
    "experiment_type",
    required=True,
    type=click.Choice(["interaction", "illumination"]),
    help="Experiment type.",
)
@click.option("--notes", default="", show_default=False, help="Optional researcher notes.")
def cli(exp_path: Path, experiment_type: str, notes: str) -> None:
    """Upload an FLS experiment directory to R2."""
    timestamp = datetime.now(timezone.utc)
    prefix = _r2_prefix(timestamp, experiment_type)

    storage = R2Storage.from_env()

    # Upload metadata.json (generated in memory — does not touch the source directory)
    metadata = _generate_metadata(exp_path, experiment_type, timestamp, notes)
    metadata_bytes = json.dumps(metadata, indent=2).encode()
    click.echo(f"Uploading to {prefix}/")
    storage.upload_bytes(metadata_bytes, f"{prefix}/metadata.json", content_type="application/json")
    click.echo("  metadata.json ✓")

    # Upload all files from the experiment directory, preserving structure
    files = sorted(f for f in exp_path.rglob("*") if f.is_file())
    if not files:
        click.echo("  (no files found in experiment directory)", err=True)
        return

    for file_path in files:
        relative = file_path.relative_to(exp_path)
        r2_key = f"{prefix}/{relative}"
        click.echo(f"  {relative}", nl=False)
        storage.upload_file(file_path, r2_key)
        click.echo(" ✓")

    click.echo(f"\nDone. {len(files) + 1} file(s) stored at: {prefix}")
