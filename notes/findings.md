# Findings

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
- `dist_sq` — squared distance from target position (localization accuracy)
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
