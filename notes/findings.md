# Findings

## Interaction Data Format

**Filename structure:** `{experiment_name}_{date}_{time}.json` + matching `.mp4`
- No `lb` prefix — single file covers the whole experiment (not one per FLS)
- `{experiment_name}` encodes the interaction type and parameters (e.g. `GraceTime_2sec`)
- Video is present alongside the JSON

**Structure:** A single chronological event log — all event types interleaved in time order.

**Event types:**

| Type | Description |
|---|---|
| `frames` | Vicon 3D position data — same as illumination but also includes `vel` (velocity vector) |
| `commands` | High-level commands sent to the drone (e.g. `go_to` with target coordinates) |
| `state` | Crazyflie onboard state — velocity + roll/pitch/yaw, same as `cf` in illumination |
| `events` | Named interaction events e.g. `"Waiting For User Interaction"` |
| `configs` | Experiment config params (translation controller settings: `delta_v`, `Delta`, `delta`) |
| `start` | Experiment start timestamp |

**Key differences from illumination:**
- Single file per experiment (not one per FLS)
- Has video
- Has `commands` — every movement command sent to the drone
- Has `events` — captures human-drone interaction moments
- `frames` includes velocity in addition to position
- No shape name in filename

**Events — 3 types:**
- `Waiting For User Interaction` (×1) — experiment starts, drone hovers waiting to be touched
- `User Pushing` (×220) — fired continuously while user pushes; includes `speed`, `vel` (velocity vector), `heading`, current `Pos`, and `Target`
- `User Disengage` (×14) — user stops pushing; includes speed, velocity, position, target

14 distinct push interactions in this experiment, each composed of many `User Pushing` events while contact was held.

**Commands — 3 types:**
- `HighLevelCommander.go_to` (×1) — initial takeoff/positioning
- `Commander.send_position_setpoint` (×2,950) — continuous position commands sent to the drone during the experiment (the control loop)
- `Commander.send_notify_setpoint_stop` (×2) — stop commands

**Config:**
- `delta_v`, `Delta`, `delta` — translation controller tuning params
- `GraceTime_2sec` in the filename = 2-second grace period after user disengages before drone returns to target position

**Duration:** 84.4 seconds, 8,320 Vicon frames (~98 fps)

**Key insight:** `User Pushing` events are the richest data point for interaction experiments — they capture direction, speed, and position of each push. This is what differentiates one interaction experiment from another and is the most useful data to embed/search over.

---

## Illumination Data Format

**Filename structure:** `lb{N}_{shape}_{date}_{time}.json`
- `lb{N}` — lightbulb ID, i.e. the FLS index (e.g. lb3, lb4, lb5)
- `{shape}` — illumination shape being rendered (e.g. happy_emoji)
- `{date}_{time}` — experiment date and time

One file per FLS. Multiple files from the same experiment share the same `{shape}_{date}_{time}` suffix.

**Top-level keys:**
- `start_time` / `stop_time` — Unix timestamps for the experiment duration
- `frames` — position stream from the external Vicon motion capture system
- `cf` — onboard telemetry from the Crazyflie drone itself

**`frames` entries:**
- `frame_id` — sequential frame number
- `tvec` — `[x, y, z]` 3D position of the FLS in space
- `time` — Unix timestamp

**`cf` entries:**
- `cf.time` — list of timestamps (~10Hz)
- `cf.params.stateEstimate.roll` — roll angle in degrees
- `cf.params.stateEstimate.pitch` — pitch angle in degrees
- `cf.params.stateEstimate.yaw` — yaw angle in degrees

Two separate data sources per FLS:
- **Vicon** (`frames`) — external ground truth 3D position
- **Crazyflie IMU** (`cf`) — onboard orientation (roll/pitch/yaw)

Together they give the full 6DOF pose of each FLS over time.

**`cf` abbreviation:** stands for Crazyflie, the drone hardware used in the lab. `cflib` is the official Crazyflie Python SDK (https://github.com/bitcraze/crazyflie-lib-python) likely used to record the onboard telemetry.
