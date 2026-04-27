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

## Type Checking

Run pyright before committing to ensure no type errors are left behind:

```bash
uv pip install -e ".[dev]"   # first time only
.venv/bin/pyright src/fls/
```

Expected output: `0 errors, 0 warnings, 0 informations`. Do not commit if there are errors.

## Code Conventions

- **Docstrings**: [Google style](https://google.github.io/styleguide/pyguide.html#38-comments-and-docstrings)
- **Inline comments**: only when the WHY is non-obvious — not to describe what the code does
- **Error handling**: raise specific exceptions (`RuntimeError`, `FileNotFoundError`) with actionable messages; catch at the CLI boundary in `cli()` and use `sys.exit("Error: ...")` 
- **Type hints**: required on all function signatures

## Integration Testing

No automated test suite yet. Test manually by running the CLI against real Google Drive.

**Setup for a blank-slate test:**
- Delete `~/.config/fls/token.json` to force fresh browser auth
- Delete or modify `.env` to test missing/invalid config error paths

**Test cases:**

| Scenario | How to trigger | Expected result |
|---|---|---|
| First-run auth | Delete `~/.config/fls/token.json`, run upload | Browser opens, auth succeeds, upload completes |
| Corrupted token | `echo "bad" > ~/.config/fls/token.json`, run upload | Recovers silently, browser re-auth, upload completes |
| Missing env var | Remove `GDRIVE_FOLDER_ID` from `.env` | Clean error: "Missing required environment variables" |
| Bad client secret path | Set `GOOGLE_CLIENT_SECRET` to nonexistent path | Clean error: "Client secret file not found" |
| Invalid folder ID | Set `GDRIVE_FOLDER_ID=invalidid`, run upload | Clean error: "Drive API request failed (404 ...)" |
| Normal upload | Run with valid experiment directory | Files appear in Drive under correct timestamped path |

## Key Design Decisions

- Each upload creates a new timestamped folder — no resume logic, safe to retry
- `resumable=True` with 5MB chunks handles transient network drops at the chunk level
- Folder IDs are cached per `DriveStorage` instance to reduce Drive API calls
- OAuth2 `InstalledAppFlow` (not service account) — service accounts lack Drive storage quota
- Token refresh failure (`RefreshError`) deletes the token and re-triggers browser auth automatically

