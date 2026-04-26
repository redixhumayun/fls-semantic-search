import json

from .config import PIPELINE_VERSIONS
from .models import ExperimentListing
from .storage import DriveStorage


def _is_fresh(embeddings_data: dict) -> bool:
    """Return True if all pipeline version fields in embeddings_data match PIPELINE_VERSIONS.

    Args:
        embeddings_data: Parsed contents of an existing embeddings.json.

    Returns:
        True if the embeddings are current, False if regeneration is needed.
    """
    return all(embeddings_data.get(k) == v for k, v in PIPELINE_VERSIONS.items())


def _find_child_folder(storage: DriveStorage, parent_id: str, name: str) -> str | None:
    """Return the Drive folder ID of a direct child folder by name, or None if not found.

    Args:
        storage: Authenticated DriveStorage instance.
        parent_id: Drive ID of the parent folder to search within.
        name: Exact name of the child folder to find.

    Returns:
        The child folder ID, or None if no matching folder exists.
    """
    for item in storage.list_folder(parent_id):
        if item["name"] == name and item["mimeType"] == "application/vnd.google-apps.folder":
            return item["id"]
    return None


def find_experiments(
    storage: DriveStorage,
    experiments_prefix: str,
    force: bool = False,
) -> tuple[list[ExperimentListing], list[ExperimentListing], list[tuple[str, str]]]:
    """Crawl Drive and return (to_process, already_fresh, crawl_errors) lists.

    Walks fls-experiments → date folders → experiment folders. An experiment
    is considered fresh when its embeddings.json exists and all four pipeline
    version fields match PIPELINE_VERSIONS. Experiments whose metadata.json or
    embeddings.json cannot be parsed are collected in crawl_errors rather than
    aborting the crawl.

    Args:
        storage: Authenticated DriveStorage instance.
        experiments_prefix: Name of the experiments root folder (e.g. 'fls-experiments').
        force: When True, treat all experiments as needing regeneration.

    Returns:
        Tuple of (experiments to embed, experiments already up-to-date, crawl errors).
        Each crawl error is a (drive_path, message) pair.
    """
    prefix_id = _find_child_folder(storage, storage._root_folder_id, experiments_prefix)
    if prefix_id is None:
        return [], [], []

    to_process: list[ExperimentListing] = []
    already_fresh: list[ExperimentListing] = []
    crawl_errors: list[tuple[str, str]] = []

    for date_folder in storage.list_folder(prefix_id):
        if date_folder["mimeType"] != "application/vnd.google-apps.folder":
            continue

        for exp_folder in storage.list_folder(date_folder["id"]):
            if exp_folder["mimeType"] != "application/vnd.google-apps.folder":
                continue

            drive_path = f"{experiments_prefix}/{date_folder['name']}/{exp_folder['name']}"
            items = storage.list_folder(exp_folder["id"])
            files = {
                f["name"]: f["id"]
                for f in items
                if f["mimeType"] != "application/vnd.google-apps.folder"
            }

            if "metadata.json" not in files:
                continue

            try:
                metadata = json.loads(storage.download_file(files["metadata.json"]))
            except (json.JSONDecodeError, Exception) as e:
                crawl_errors.append((drive_path, f"could not parse metadata.json: {e}"))
                continue

            listing = ExperimentListing(
                folder_id=exp_folder["id"],
                drive_path=drive_path,
                files=files,
                metadata=metadata,
            )

            if not force and "embeddings.json" in files:
                try:
                    embeddings_data = json.loads(storage.download_file(files["embeddings.json"]))
                except (json.JSONDecodeError, Exception) as e:
                    crawl_errors.append((drive_path, f"could not parse embeddings.json: {e}"))
                    to_process.append(listing)
                    continue
                if _is_fresh(embeddings_data):
                    already_fresh.append(listing)
                    continue

            to_process.append(listing)

    return to_process, already_fresh, crawl_errors
