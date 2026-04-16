# fls-semantic-search

## Setup

1. Clone the repo and create a virtual environment:
   ```bash
   uv venv && uv pip install -e .
   ```

2. Copy `.env.example` to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```

   | Variable | Description |
   |---|---|
   | `GOOGLE_CLIENT_SECRET` | Path to your OAuth client secret JSON file |
   | `GDRIVE_FOLDER_ID` | ID of the shared Google Drive folder for experiment data |

3. On first run, a browser window will open to authenticate with the lab Google account. The token is saved to `~/.config/fls/token.json` and reused for subsequent runs.

## Usage

```bash
fls-upload --experiment <path> --type <interaction|illumination> [--notes "optional notes"]
```

**Example:**
```bash
fls-upload --experiment ./my-experiment --type illumination --notes "rose shape, 25 FLSs"
```

## Storage Structure

Experiments are stored in Google Drive under the following path format:

```
fls-experiments/YYYY-MM-DD/HH-MM-SS_type/
├── metadata.json
├── logs/
│   └── fls_001.log
└── video.mp4
```

The timestamp is UTC, taken at the moment `fls-upload` is run.

## Contributing

This project uses [Google style docstrings](https://google.github.io/styleguide/pyguide.html#38-comments-and-docstrings).
