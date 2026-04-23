# fls-semantic-search

## Setup

1. Install [uv](https://docs.astral.sh/uv/getting-started/installation/) if you don't have it.

2. Clone the repo and install:
   ```bash
   git clone https://github.com/redixhumayun/fls-semantic-search.git
   cd fls-semantic-search
   uv venv && uv pip install -e .
   ```

3. Copy `.env.example` to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```

   | Variable | Description |
   |---|---|
   | `GOOGLE_CLIENT_SECRET` | Path to the `client_secret.json` file provided by the lab admin |
   | `GDRIVE_FOLDER_ID` | ID of the shared Google Drive folder for experiment data |

   You will receive `client_secret.json` and the folder ID from the lab admin. Save the file anywhere on your machine and set `GOOGLE_CLIENT_SECRET` to its full path, e.g.:
   ```
   GOOGLE_CLIENT_SECRET=/Users/yourname/client_secret.json
   ```

4. On first run, a browser window will open to authenticate with the lab Google account. The token is saved to `~/.config/fls/token.json` and reused for subsequent runs.

## Usage

```bash
fls-upload --experiment <path> --type <interaction|illumination> [--notes "optional notes"] [--datetime YYYY-MM-DD_HH-MM-SS]
```

**Example:**
```bash
fls-upload --experiment ./my-experiment --type illumination --notes "rose shape, 25 FLSs"
```

Use `--datetime` when you want the upload to use a specific UTC timestamp instead of the current time, for example when preserving the experiment's original run time. That timestamp is used for both the Drive folder path and the generated `metadata.json`, and it must be in `YYYY-MM-DD_HH-MM-SS` format.

## Storage Structure

Experiments are stored in Google Drive under the following path format:

```
fls-experiments/YYYY-MM-DD/HH-MM-SS_type/
├── metadata.json
├── logs/
│   └── fls_001.log
└── video.mp4
```

The timestamp is UTC. By default it is taken at the moment `fls-upload` is run, or you can override it with `--datetime`.

## Contributing

This project uses [Google style docstrings](https://google.github.io/styleguide/pyguide.html#38-comments-and-docstrings).
