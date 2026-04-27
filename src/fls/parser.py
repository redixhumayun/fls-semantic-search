import json
import re
from typing import Callable

import yaml

from .models import IlluminationData, InteractionData

def parse_illumination(
    files: dict[str, str],
    download_fn: Callable[[str], bytes],
) -> IlluminationData:
    """Parse an illumination experiment.

    Args:
        files: Mapping of filename to Drive file ID for the experiment folder.
        download_fn: Callable that fetches file bytes given a Drive file ID.

    Returns:
        Parsed IlluminationData.

    Raises:
        ValueError: If required files are missing or filenames are inconsistent.
    """
    telemetry = {
        name: fid
        for name, fid in files.items()
        if name not in ("metadata.json", "embeddings.json") and name.endswith(".json")
    }
    if not telemetry:
        raise ValueError("No illumination telemetry .json files found")

    # Matches lb{N}_{shape_name}_{YYYY-MM-DD}_{HH-MM-SS}.json
    # e.g. lb1_nsf_anchor_2026-04-13_16-43-48.json — capture group 1 is shape_name.
    illumination_re = re.compile(r"^lb\d+_(.+)_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$")

    shape_names: set[str] = set()
    for name in telemetry:
        m = illumination_re.match(name)
        if not m:
            raise ValueError(f"Telemetry filename does not match expected pattern: {name!r}")
        shape_names.add(m.group(1))

    if len(shape_names) != 1:
        raise ValueError(f"Telemetry files disagree on shape name: {shape_names}")

    first_name, first_id = next(iter(telemetry.items()))
    raw = download_fn(first_id)
    if not raw:
        raise ValueError(f"Telemetry file {first_name!r} is empty")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"Telemetry file {first_name!r} is invalid JSON: {e}") from e
    if "start_time" not in data or "stop_time" not in data:
        raise ValueError("Telemetry file is missing start_time or stop_time")

    return IlluminationData(
        shape_name=shape_names.pop(),
        fls_count=len(telemetry),
        duration_seconds=data["stop_time"] - data["start_time"],
        has_video=any(name.endswith(".mp4") for name in files),
    )


def parse_interaction(
    files: dict[str, str],
    download_fn: Callable[[str], bytes],
) -> InteractionData:
    """Parse an interaction experiment.

    Args:
        files: Mapping of filename to Drive file ID for the experiment folder.
        download_fn: Callable that fetches file bytes given a Drive file ID.

    Returns:
        Parsed InteractionData.

    Raises:
        ValueError: If required files are missing or YAML fields are absent.
    """
    yaml_files = {name: fid for name, fid in files.items() if name.endswith(".yaml")}
    if not yaml_files:
        raise ValueError("No .yaml config file found")

    telemetry = {
        name: fid
        for name, fid in files.items()
        if name not in ("metadata.json", "embeddings.json") and name.endswith(".json")
    }
    if not telemetry:
        raise ValueError("No interaction telemetry .json files found")

    yaml_fid = next(iter(yaml_files.values()))
    try:
        config = yaml.safe_load(download_fn(yaml_fid))
    except yaml.YAMLError as exc:
        raise ValueError(f"Invalid YAML config: {exc}") from exc

    if not isinstance(config, dict):
        raise ValueError("YAML top level must be a mapping")

    interaction_name = config.get("name")
    if not interaction_name:
        raise ValueError("YAML is missing top-level 'name'")

    try:
        interaction_action = config["Interaction"]["action"]
        duration_seconds = config["Interaction"]["config"]["duration"]
        grace_time_seconds = config["Interaction"]["config"]["grace_time"]
    except (KeyError, TypeError) as exc:
        raise ValueError(f"YAML is missing required Interaction fields: {exc}") from exc

    return InteractionData(
        interaction_name=interaction_name,
        fls_count=len(telemetry),
        interaction_action=interaction_action,
        duration_seconds=duration_seconds,
        grace_time_seconds=grace_time_seconds,
        has_video=any(name.endswith(".mp4") for name in files),
    )
