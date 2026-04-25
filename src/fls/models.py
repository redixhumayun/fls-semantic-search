from dataclasses import dataclass, field

from PIL import Image


@dataclass
class IlluminationData:
    """Parsed data from an illumination experiment.

    Attributes:
        shape_name: Name of the illuminated shape, extracted from telemetry filenames.
        fls_count: Number of FLS drones, determined by counting telemetry files.
        duration_seconds: Experiment duration computed from stop_time - start_time.
        has_video: True if an .mp4 file is present in the experiment folder.
    """

    shape_name: str
    fls_count: int
    duration_seconds: float
    has_video: bool


@dataclass
class InteractionData:
    """Parsed data from an interaction experiment.

    Attributes:
        interaction_name: Experiment name from the YAML top-level 'name' field.
        fls_count: Number of FLS drones, determined by counting telemetry files.
        interaction_action: Interaction action type from YAML Interaction.action.
        duration_seconds: Configured duration from YAML Interaction.config.duration.
        grace_time_seconds: Grace time from YAML Interaction.config.grace_time.
        has_video: True if an .mp4 file is present in the experiment folder.
    """

    interaction_name: str
    fls_count: int
    interaction_action: str
    duration_seconds: float
    grace_time_seconds: float
    has_video: bool


@dataclass
class EmbeddingItem:
    """A single embedding record within an embeddings.json items list.

    Attributes:
        id: Unique identifier for this item (e.g. 'experiment_text', 'snapshot_first').
        modality: Either 'text' or 'image'.
        timestamp: ISO 8601 timestamp indicating when this item was captured.
        source_path: Relative path to the source file within the experiment folder.
        text_summary: Human-readable summary string used to generate the embedding.
        embedding: L2-normalised CLIP embedding vector (512 floats).
    """

    id: str
    modality: str
    timestamp: str
    source_path: str
    text_summary: str
    embedding: list[float]


@dataclass
class Snapshot:
    """A single extracted video frame and its metadata.

    Attributes:
        id: Snapshot identifier (e.g. 'snapshot_first', 'snapshot_middle_1').
        path: Relative destination path within the experiment folder (e.g. 'snapshots/first.jpg').
        image: Decoded frame as a PIL image.
        offset_seconds: Time offset from the start of the video in seconds.
    """

    id: str
    path: str
    image: Image.Image
    offset_seconds: float


@dataclass
class ExperimentListing:
    """An experiment folder discovered during a Drive crawl.

    Attributes:
        folder_id: Drive folder ID for the experiment.
        drive_path: Full path within the root folder (e.g. 'fls-experiments/2026-04-23/14-35-14_interaction').
        files: Mapping of filename to Drive file ID for all non-folder items in the experiment folder.
        metadata: Parsed contents of the experiment's metadata.json.
    """

    folder_id: str
    drive_path: str
    files: dict[str, str] = field(default_factory=dict)
    metadata: dict = field(default_factory=dict)
