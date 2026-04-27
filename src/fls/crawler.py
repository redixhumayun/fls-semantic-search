import json

from googleapiclient.errors import HttpError

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
    path_filter: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
) -> tuple[list[ExperimentListing], list[ExperimentListing], list[tuple[str, str]]]:
    """Crawl Drive and return (to_process, already_fresh, crawl_errors) lists.

    Walks fls-experiments → date folders → experiment folders. An experiment
    is considered fresh when its embeddings.json exists and all four pipeline
    version fields match PIPELINE_VERSIONS. Experiments whose metadata.json or
    embeddings.json cannot be parsed are collected in crawl_errors rather than
    aborting the crawl.

    When path_filter is provided, navigation jumps directly to the specified
    date or experiment folder instead of walking the full hierarchy.
    When from_date/to_date are provided, date folders outside the range are
    skipped without listing their contents.

    Args:
        storage: Authenticated DriveStorage instance.
        experiments_prefix: Name of the experiments root folder (e.g. 'fls-experiments').
        force: When True, treat all experiments as needing regeneration.
        path_filter: Optional Drive path to limit the scan (e.g. 'fls-experiments/2026-04-23'
            or 'fls-experiments/2026-04-23/14-35-14_interaction').
        from_date: Optional lower bound date string (YYYY-MM-DD, inclusive).
        to_date: Optional upper bound date string (YYYY-MM-DD, inclusive).

    Returns:
        Tuple of (experiments to embed, experiments already up-to-date, crawl errors).
        Each crawl error is a (drive_path, message) pair.
    """
    prefix_id = _find_child_folder(storage, storage._root_folder_id, experiments_prefix)
    if prefix_id is None:
        return [], [], []

    # Parse path_filter into (date_name, exp_name) components if provided
    filter_date: str | None = None
    filter_exp: str | None = None
    if path_filter:
        parts = path_filter.strip("/").split("/")
        if len(parts) >= 2:
            filter_date = parts[1]
        if len(parts) >= 3:
            filter_exp = parts[2]

    to_process: list[ExperimentListing] = []
    already_fresh: list[ExperimentListing] = []
    crawl_errors: list[tuple[str, str]] = []
    checked = 0

    # Build the list of date folders to iterate — navigate directly if filter_date is set
    if filter_date:
        date_folder_id = _find_child_folder(storage, prefix_id, filter_date)
        date_folders = [{"id": date_folder_id, "name": filter_date, "mimeType": "application/vnd.google-apps.folder"}] if date_folder_id else []
    else:
        date_folders = storage.list_folder(prefix_id)

    for date_folder in date_folders:
        if date_folder["mimeType"] != "application/vnd.google-apps.folder":
            continue

        date_name = date_folder["name"]
        if from_date and date_name < from_date:
            continue
        if to_date and date_name > to_date:
            continue

        # Build the list of experiment folders — navigate directly if filter_exp is set
        if filter_exp:
            exp_folder_id = _find_child_folder(storage, date_folder["id"], filter_exp)
            exp_folders = [{"id": exp_folder_id, "name": filter_exp, "mimeType": "application/vnd.google-apps.folder"}] if exp_folder_id else []
        else:
            exp_folders = storage.list_folder(date_folder["id"])

        for exp_folder in exp_folders:
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

            checked += 1
            print(f"\rScanning... {checked} experiments checked", end="", flush=True)

            try:
                metadata = json.loads(storage.download_file(files["metadata.json"]))
            except (json.JSONDecodeError, HttpError) as e:
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
                except (json.JSONDecodeError, HttpError) as e:
                    crawl_errors.append((drive_path, f"could not parse embeddings.json: {e}"))
                    to_process.append(listing)
                    continue
                if _is_fresh(embeddings_data):
                    already_fresh.append(listing)
                    continue

            to_process.append(listing)

    print("\r", end="", flush=True)  # clear the scanning line
    return to_process, already_fresh, crawl_errors
