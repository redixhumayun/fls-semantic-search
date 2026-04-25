import tempfile
from pathlib import Path

import av

from .models import Snapshot

_AV_TIME_BASE = 1_000_000  # av container timestamps are in microseconds

SNAPSHOT_DEFS = [
    ("snapshot_first",    "snapshots/first.jpg"),
    ("snapshot_middle_1", "snapshots/middle_1.jpg"),
    ("snapshot_middle_2", "snapshots/middle_2.jpg"),
    ("snapshot_middle_3", "snapshots/middle_3.jpg"),
    ("snapshot_last",     "snapshots/last.jpg"),
]


def extract_snapshots(video_bytes: bytes) -> list[Snapshot]:
    """Extract five representative frames from a video.

    Selects the first frame, last frame, and three evenly-spaced middle frames.
    Seeks to each target timestamp rather than decoding all frames.

    Args:
        video_bytes: Raw MP4 bytes.

    Returns:
        List of up to five Snapshot objects in order: first, middle_1–3, last.

    Raises:
        ValueError: If video duration cannot be determined.
    """
    tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    try:
        tmp.write(video_bytes)
        tmp.close()

        container = av.open(tmp.name)
        video_stream = container.streams.video[0]

        if container.duration is None:
            raise ValueError("Cannot determine video duration")

        duration_s = container.duration / _AV_TIME_BASE

        # Target offsets: first, 25%, 50%, 75%, just-before-last
        offsets = [
            0.0,
            duration_s * 0.25,
            duration_s * 0.50,
            duration_s * 0.75,
            duration_s * 0.999,
        ]

        snapshots: list[Snapshot] = []
        for (snap_id, snap_path), offset_s in zip(SNAPSHOT_DEFS, offsets):
            container.seek(int(offset_s * _AV_TIME_BASE))
            frame = None
            for packet in container.demux(video_stream):
                for f in packet.decode():
                    frame = f
                    break
                if frame is not None:
                    break

            if frame is None:
                continue

            actual_offset = (
                float(frame.pts * video_stream.time_base)
                if frame.pts is not None and video_stream.time_base is not None
                else offset_s
            )
            snapshots.append(Snapshot(
                id=snap_id,
                path=snap_path,
                image=frame.to_image(),
                offset_seconds=actual_offset,
            ))

        container.close()
        return snapshots
    finally:
        Path(tmp.name).unlink(missing_ok=True)
