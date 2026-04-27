from pathlib import Path

_CONFIG_DIR = Path.home() / ".config" / "fls"

TOKEN_PATH = _CONFIG_DIR / "token.json"
EMBED_ERROR_LOG = _CONFIG_DIR / "embed_errors.log"
EXPERIMENTS_PREFIX_DEFAULT = "fls-experiments"

CLIP_MODEL_NAME = "openai/clip-vit-base-patch32"

PIPELINE_VERSIONS: dict[str, str] = {
    "schema_version": "1",
    "embedding_model": CLIP_MODEL_NAME,
    "summary_version": "1",
    "snapshot_version": "1",
}
