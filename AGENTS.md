# FLS Semantic Search — Agent Instructions

## Project Overview

A Python CLI tool for uploading FLS (Flying Light Specks) experiment data to Google Drive. Researchers run `fls-upload` from the command line after an experiment to store data in a shared lab Drive folder.

V0 scope: upload only. No embedding generation or search yet.

## Setup

```bash
uv venv && uv pip install -e .
cp .env.example .env  # fill in GOOGLE_CLIENT_SECRET and GDRIVE_FOLDER_ID
```

On first run, a browser window opens for OAuth2 authentication. The token is cached at `~/.config/fls/token.json` for subsequent runs.

## Running the CLI

```bash
.venv/bin/fls-upload --experiment <path> --type <interaction|illumination> [--notes "..."]
```

## Code Conventions

- **Docstrings**: [Google style](https://google.github.io/styleguide/pyguide.html#38-comments-and-docstrings)
- **Inline comments**: only when the WHY is non-obvious — not to describe what the code does
- **Error handling**: raise specific exceptions (`RuntimeError`, `FileNotFoundError`) with actionable messages; catch at the CLI boundary in `cli()` and use `sys.exit("Error: ...")` 
- **Type hints**: required on all function signatures

## Key Design Decisions

- Each upload creates a new timestamped folder — no resume logic, safe to retry
- `resumable=True` with 5MB chunks handles transient network drops at the chunk level
- Folder IDs are cached per `DriveStorage` instance to reduce Drive API calls
- OAuth2 `InstalledAppFlow` (not service account) — service accounts lack Drive storage quota
- Token refresh failure (`RefreshError`) deletes the token and re-triggers browser auth automatically

