const WASM_PATH = "wasm/cubacadabra_engine.wasm";

async function loadWasm() {
  const url = new URL(WASM_PATH, document.baseURI);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`The Cubacadabra engine could not be loaded (${response.status}).`);
  }

  if (WebAssembly.instantiateStreaming) {
    try {
      return (await WebAssembly.instantiateStreaming(response, {})).instance;
    } catch (error) {
      // Some development servers serve .wasm with an incorrect MIME type.
      // The array-buffer path keeps local development resilient.
      if (response.bodyUsed) {
        const fallbackResponse = await fetch(url);
        return (await WebAssembly.instantiate(
          await fallbackResponse.arrayBuffer(),
          {},
        )).instance;
      }
      throw error;
    }
  }

  return (await WebAssembly.instantiate(await response.arrayBuffer(), {})).instance;
}

export async function createRustEngine() {
  const instance = await loadWasm();
  const { exports } = instance;
  const handle = exports.engine_create();
  if (!handle) throw new Error("The Cubacadabra engine could not be created.");

  function call(name, ...args) {
    return exports[name](handle, ...args);
  }

  function setLaunchPad(index, { position, radius, countdown }) {
    call(
      "engine_set_launch_pad",
      index,
      position[0],
      position[1],
      radius,
      countdown,
    );
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
    };
  }

  return {
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
    configureLaunchPads(pads) {
      call("engine_set_launch_pad_count", pads.length);
      pads.forEach((pad, index) => setLaunchPad(index, pad));
    },
    setLaunchPad,
    step(delta) {
      call("engine_step", delta);
    },
    resetView() {
      call("engine_reset_view");
    },
    readFrame,
    destroy() {
      call("engine_destroy");
    },
  };
}
