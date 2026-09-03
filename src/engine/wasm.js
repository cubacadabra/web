export function createRustEngine(exports) {
  const handle = exports.engine_create();
  if (!handle) throw new Error("The cubacadabra engine could not be created.");

  function call(name, ...args) {
    return exports[name](handle, ...args);
  }

  function readFrame() {
    const memory = exports.memory;
    const pointer = call("engine_snapshot_ptr");
    const length = exports.engine_snapshot_len();
    const stride = exports.engine_snapshot_stride();
    const snapshot = new Float32Array(memory.buffer, pointer, length);
    const player = {
      position: {
        x: snapshot[0],
        y: snapshot[1],
        z: snapshot[2],
      },
      yaw: snapshot[3],
      walkCycle: snapshot[4],
      grounded: snapshot[5] > 0.5,
      moving: snapshot[6] > 0.5,
      sprinting: snapshot[7] > 0.5,
    };
    const agentCount = call("engine_agent_count");
    const agents = [];
    for (let index = 0; index < agentCount; index += 1) {
      const offset = (index + 1) * stride;
      agents.push({
        position: {
          x: snapshot[offset],
          y: snapshot[offset + 1],
          z: snapshot[offset + 2],
        },
        yaw: snapshot[offset + 3],
        walkCycle: snapshot[offset + 4],
        phase: snapshot[offset + 5],
        meetingIndex: snapshot[offset + 6],
        assembled: snapshot[offset + 7] > 0.5,
      });
    }

    const launchPadCount = call("engine_launch_pad_count");
    const launchPads = [];
    for (let index = 0; index < launchPadCount; index += 1) {
      launchPads.push({
        occupants: call("engine_launch_pad_occupants", index),
        seconds: call("engine_launch_pad_seconds", index),
        phase: call("engine_launch_pad_phase", index),
      });
    }

    return {
      elapsed: exports.engine_elapsed(handle),
      player,
      agents,
      camera: {
        yaw: call("engine_camera_yaw"),
        pitch: call("engine_camera_pitch"),
        distance: call("engine_camera_distance"),
      },
      launchPadCounts: launchPads.map((_, index) => (
        call("engine_launch_pad_occupants", index)
      )),
      totalPlayers: agentCount + 1,
      isFull: agentCount >= 17,
      launchPads,
      playerLaunchPad: call("engine_player_launch_pad"),
      launchEventId: call("engine_launch_event_id"),
      lastLaunchPad: call("engine_last_launch_pad"),
      lastLaunchOccupants: call("engine_last_launch_occupants"),
      activeWorldIndex: call("engine_active_world"),
      worldEventId: call("engine_world_event_id"),
      lastWorldSourcePad: call("engine_last_world_source_pad"),
      lastWorldDestination: call("engine_last_world_destination"),
      settingsRoomState: call("engine_settings_room_state"),
    };
  }

  return {
    loadGameScript(source) {
      const bytes = new TextEncoder().encode(source);
      const pointer = call("engine_script_buffer_ptr", bytes.length);
      if (!pointer && bytes.length) {
        throw new Error("The game script buffer could not be allocated.");
      }
      new Uint8Array(exports.memory.buffer, pointer, bytes.length).set(bytes);
      if (!call("engine_load_script_buffer")) {
        throw new Error("The game script could not be compiled.");
      }
    },
    loadGamePackage(source) {
      const bytes = new TextEncoder().encode(source);
      const pointer = call("engine_package_buffer_ptr", bytes.length);
      if (!pointer && bytes.length) {
        throw new Error("The game package buffer could not be allocated.");
      }
      new Uint8Array(exports.memory.buffer, pointer, bytes.length).set(bytes);
      if (!call("engine_load_package_buffer")) {
        throw new Error("The game manifest could not be loaded by Rust.");
      }
    },
    setUsername(username) {
      const bytes = new TextEncoder().encode(username);
      const pointer = call("engine_username_buffer_ptr", bytes.length);
      if (!pointer && bytes.length) return false;
      new Uint8Array(exports.memory.buffer, pointer, bytes.length).set(bytes);
      return Boolean(call("engine_load_username_buffer"));
    },
    setInput(forward, strafe, sprint, jump, lookX, lookY, zoomDelta) {
      call(
        "engine_set_input",
        forward,
        strafe,
        sprint ? 1 : 0,
        jump ? 1 : 0,
        lookX,
        lookY,
        zoomDelta,
      );
    },
    setRemotePlayers(players) {
      call("engine_set_remote_player_count", players.length);
      players.forEach((player, index) => {
        call(
          "engine_set_remote_player",
          index,
          player.x,
          player.y,
          player.z,
          player.yaw,
          player.moving ? 1 : 0,
          player.sprinting ? 1 : 0,
        );
      });
    },
    step(delta) {
      call("engine_step", delta);
    },
    resetView() {
      call("engine_reset_view");
    },
    readFrame,
    rendererHandle() {
      return handle;
    },
    destroy() {
      call("engine_destroy");
    },
  };
}
