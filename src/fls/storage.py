import mimetypes
import os
from pathlib import Path

from dotenv import load_dotenv
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

load_dotenv()

_SCOPES = ["https://www.googleapis.com/auth/drive"]
_ROOT_FOLDER_NAME = "FLS Experiment Data"


class DriveStorage:
    """Google Drive storage client authenticated via a service account."""

    def __init__(self, service_account_key_path: str):
        """
        Args:
            service_account_key_path: Path to the service account JSON key file.
        """
        credentials = service_account.Credentials.from_service_account_file(
            service_account_key_path, scopes=_SCOPES
        )
        self._service = build("drive", "v3", credentials=credentials)
        self._root_folder_id = self._get_or_create_folder(_ROOT_FOLDER_NAME, parent_id=None)

    @classmethod
    def from_env(cls) -> "DriveStorage":
        """Construct a DriveStorage instance from environment variables.

        Raises:
            RuntimeError: If the required environment variable is missing.
        """
        key_path = os.environ.get("GOOGLE_SERVICE_ACCOUNT_KEY")
        if not key_path:
            raise RuntimeError(
                "Missing required environment variable: GOOGLE_SERVICE_ACCOUNT_KEY\n"
                "Copy .env.example to .env and set it to the path of your service account JSON key file."
            )
        return cls(service_account_key_path=key_path)

    def _get_or_create_folder(self, name: str, parent_id: str | None) -> str:
        """Return the Drive folder ID for the given name, creating it if it does not exist.

        Args:
            name: Folder name.
            parent_id: Parent folder ID, or None for the service account root.

        Returns:
            The folder ID.
        """
        query = f"name='{name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
        if parent_id:
            query += f" and '{parent_id}' in parents"

        results = self._service.files().list(q=query, fields="files(id)").execute()
        files = results.get("files", [])
        if files:
            return files[0]["id"]

        metadata = {
            "name": name,
            "mimeType": "application/vnd.google-apps.folder",
        }
        if parent_id:
            metadata["parents"] = [parent_id]

        folder = self._service.files().create(body=metadata, fields="id").execute()
        return folder["id"]

    def upload_file(self, local_path: Path, drive_path: str) -> None:
        """Upload a local file to Drive, creating intermediate folders as needed.

        Args:
            local_path: Path to the local file.
            drive_path: Destination path within the root folder, using '/' as separator
                (e.g. '2025-04-09/10-30-00_interaction/logs/fls_001.log').
        """
        parts = Path(drive_path).parts
        folder_parts, filename = parts[:-1], parts[-1]

        parent_id = self._root_folder_id
        for part in folder_parts:
            parent_id = self._get_or_create_folder(part, parent_id=parent_id)

        mime_type = mimetypes.guess_type(str(local_path))[0] or "application/octet-stream"
        media = MediaFileUpload(str(local_path), mimetype=mime_type, resumable=True)
        self._service.files().create(
            body={"name": filename, "parents": [parent_id]},
            media_body=media,
            fields="id",
        ).execute()
