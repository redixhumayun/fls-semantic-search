# Open Questions

## Takeoff / Landing Frame Detection

The two experiment types may need different approaches:

**Illumination:** has `start_time`/`stop_time` timestamps and `tvec` z-coordinate per frame. Options:
- Detect takeoff/landing using the z value in the `tvec` vector (when drone rises above / drops below a threshold)
- Use `start_time`/`stop_time` with a small offset

**Interaction:** has explicit command log entries. Options:
- Use `HighLevelCommander.go_to` (×1) as the takeoff marker and `send_notify_setpoint_stop` as landing
- Use the z value in the `tvec` vector (same as illumination)

Should both types use the same approach for consistency, or is it acceptable to use the command log for interaction and z-height/timestamps for illumination?

## What Queries Should Researchers Be Able to Run?

- Is the room lit or dark?
- Are there people in the video clip?
- Did the drones take off successfully?
  - Metadata needs to be generated to indicate success/failure.
- Did the drones land successfully?
  - Metadata needs to be generated to indicate success/failure.
- Find experiments by shape (illumination only)
- Find experiments by number of FLSs
- Find experiments where the drone was pushed hard (interaction only)
- Find experiments by number of push interactions (interaction only)
  - False positive detection is important — events shorter than ~15ms are likely false positives and should be stored as separate metadata.
  - Start with metadata, then move to image processing.
- Find experiments by push direction (interaction only)
  - Same false positive concern as above.
- Find experiments by recovery behavior (interaction only)

## How Should Telemetry Be Converted to Text?

Once we know what queries matter, the telemetry needs to be converted into a text string for CLIP. Two options:

- **Hand-crafted** — pull specific fields and format them into a string (e.g. "happy emoji shape, 3 FLSs, avg dist_sq 0.003, duration 19s"). Simple and fast but requires us to decide upfront which fields matter.
- **LLM-generated** — feed the raw telemetry to an LLM (Qwen via DSPy, already in the stack) and have it produce a natural language summary. More flexible but adds complexity and latency to the embedding pipeline.

Which approach is preferred for V1?


