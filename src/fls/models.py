from dataclasses import dataclass, field

from PIL import Image


@dataclass
class IlluminationData:
    shape_name: str
    fls_count: int
    duration_seconds: float
    has_video: bool


@dataclass
class InteractionData:
    interaction_name: str
    fls_count: int
    interaction_action: str
    duration_seconds: float
    grace_time_seconds: float
    has_video: bool


@dataclass
class EmbeddingItem:
    id: str
    modality: str
    timestamp: str
    source_path: str
    text_summary: str
    embedding: list[float]


@dataclass
class Snapshot:
    id: str
    path: str
    image: Image.Image
    offset_seconds: float


@dataclass
class ExperimentListing:
    folder_id: str
    drive_path: str
    files: dict[str, str] = field(default_factory=dict)
    metadata: dict = field(default_factory=dict)
