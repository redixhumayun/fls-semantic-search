from .models import IlluminationData, InteractionData


def summarize_illumination(data: IlluminationData) -> str:
    """Return a deterministic text summary for an illumination experiment.

    Args:
        data: Parsed illumination experiment data.

    Returns:
        Summary string suitable for text embedding.
    """
    video_status = "video present" if data.has_video else "video absent"
    return (
        f"illumination experiment, shape {data.shape_name}, "
        f"{data.fls_count} FLSs, duration {data.duration_seconds:.1f} seconds, "
        f"{video_status}"
    )


def summarize_interaction(data: InteractionData) -> str:
    """Return a deterministic text summary for an interaction experiment.

    Args:
        data: Parsed interaction experiment data.

    Returns:
        Summary string suitable for text embedding.
    """
    video_status = "video present" if data.has_video else "video absent"
    return (
        f"interaction experiment, name {data.interaction_name}, "
        f"{data.fls_count} FLSs, action {data.interaction_action}, "
        f"configured duration {data.duration_seconds} seconds, "
        f"grace time {data.grace_time_seconds} seconds, "
        f"{video_status}"
    )
