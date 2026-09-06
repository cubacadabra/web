const SPECIES = [
  { id: "person", label: "Person", stableId: "cuba:person.v1" },
  { id: "cat", label: "Cat", stableId: "cuba:cat.v1" },
  { id: "dragon", label: "Dragon", stableId: "cuba:dragon.v1" },
];

const EXPRESSIONS = [
  "neutral", "happy", "surprised", "determined", "sad", "laughing",
  "smile", "grin", "curious", "amazed", "angry", "crying", "worried",
  "embarrassed", "sleepy", "squinting", "wink", "smirk", "confused",
  "excited", "unimpressed",
];

const OUTFITS = [
  {
    id: "everyday-hoodie",
    label: "Everyday hoodie",
    stableId: "cuba:everyday-hoodie.v1",
    pairing: "Person",
    supported: SPECIES.map(({ id }) => id),
  },
  {
    id: "puffer-explorer",
    label: "Puffer explorer",
    stableId: "cuba:puffer-explorer.v1",
    pairing: "Cat",
    supported: ["cat"],
  },
  {
    id: "raincoat",
    label: "Glossy raincoat",
    stableId: "cuba:glossy-raincoat.v1",
    pairing: "Cat",
    supported: SPECIES.map(({ id }) => id),
  },
  {
    id: "wizard-cloak",
    label: "Star wizard cloak",
    stableId: "cuba:star-wizard.v1",
    pairing: "Dragon",
    supported: ["dragon"],
  },
  {
    id: "toy-knight",
    label: "Toy knight armor",
    stableId: "cuba:toy-knight.v1",
    pairing: "Dragon",
    supported: ["dragon"],
  },
  {
    id: "fuzzy-pajamas",
    label: "Fuzzy pajamas",
    stableId: "cuba:fuzzy-pajamas.v1",
    pairing: "Person",
    supported: ["person"],
  },
];

const MOTIONS = [
  { id: "idle", label: "Idle" },
  { id: "walk", label: "Walk" },
  { id: "run", label: "Run" },
  { id: "jump", label: "Jump" },
];

const MOVEMENT_KEYS = [
  "KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown",
  "ArrowRight", "ShiftLeft", "ShiftRight",
];
const LOOK_SENSITIVITY = 0.0062;
const SHOWCASE_CAMERA_DISTANCE = 8;

function titleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function shortestAngle(angle) {
  return ((angle + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
}

function showcaseRequested() {
  const query = new URLSearchParams(window.location.search);
  return import.meta.env?.DEV === true || query.get("showcase") === "1";
}

function makeButton({ className, label, detail, selected, onClick }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.setAttribute("aria-pressed", String(selected));
  button.classList.toggle("is-selected", selected);
  button.textContent = label;
  if (detail) button.title = detail;
  button.addEventListener("click", onClick);
  return button;
}

export function createCharacterShowcaseController({
  elements,
  state,
  engine,
  manifestSource,
  runtimeWorldIds = [],
  onAppearanceChange = null,
  initialAppearance = null,
}) {
  const enabled = showcaseRequested() && Boolean(elements.characterShowcasePanel);
  const removeListeners = [];
  const initialSpecies = SPECIES.find(({ stableId }) => stableId === initialAppearance?.body);
  const initialOutfit = OUTFITS.find(({ stableId }) => stableId === initialAppearance?.outfit);
  const selection = {
    species: initialSpecies?.id ?? "person",
    expression: EXPRESSIONS.includes(initialAppearance?.face) ? initialAppearance.face : "happy",
    outfit: initialOutfit?.id ?? "everyday-hoodie",
    motion: "idle",
    reducedEffects: false,
  };
  let open = false;
  let waveCount = 0;
  let faceCameraActive = false;
  let faceCameraPending = false;
  let appearanceRevision = Number(initialAppearance?.revision) || 0;
  const capabilities = engine.getCharacterShowcaseCapabilities?.() ?? {};

  function appearanceDefinition() {
    const manifest = JSON.parse(manifestSource);
    const player = manifest.avatars?.player ?? {};
    const legacyColors = {
      skin: player.skin,
      primary: player.shirt,
      secondary: player.pants,
      sole: player.shoes,
    };
    const previousRevision = Number(player.character?.revision) || 0;
    const character = {
      ...(player.character ?? {}),
      version: 1,
      body: currentSpecies().stableId,
      face: selection.expression,
      outfit: currentOutfit().stableId,
      colors: {
        ...(player.character?.colors ?? {}),
        ...Object.fromEntries(
          Object.entries(legacyColors).filter(([, value]) => typeof value === "string"),
        ),
      },
      revision: Math.max(appearanceRevision, previousRevision) + 1,
    };
    appearanceRevision = character.revision;
    return character;
  }

  function appearanceManifest(appearance = appearanceDefinition()) {
    const manifest = JSON.parse(manifestSource);
    const player = manifest.avatars?.player ?? {};
    manifest.avatars = {
      ...(manifest.avatars ?? {}),
      player: {
        ...player,
        character: appearance,
      },
    };
    return JSON.stringify(manifest);
  }

  function applyAppearance() {
    if (capabilities.localAppearance && typeof engine.setLocalAppearance === "function") {
      try {
        const appearance = appearanceDefinition();
        const applied = Boolean(engine.setLocalAppearance(JSON.stringify(appearance)));
        if (applied) {
          return { applied: true, mode: "local", appearance };
        }
      } catch (error) {
        console.error("Character appearance could not be applied through the local API.", error);
      }
    }
    if (!manifestSource || typeof engine.loadGamePackage !== "function") {
      return { applied: false, mode: "unavailable" };
    }
    const frame = state.runtime.engineFrame;
    const worldIndex = runtimeWorldIds.indexOf(state.runtime.worldId);
    try {
      const appearance = appearanceDefinition();
      engine.loadGamePackage(appearanceManifest(appearance));
      if (worldIndex >= 0) engine.startWorld(worldIndex);
      if (frame) {
        engine.reconcilePlayer(frame.player.position, frame.camera.yaw);
      }
      return { applied: true, mode: "package", appearance };
    } catch (error) {
      console.error("Character appearance preview could not be applied.", error);
      return { applied: false, mode: "package" };
    }
  }

  function listen(target, type, handler) {
    if (!target) return;
    target.addEventListener(type, handler);
    removeListeners.push(() => target.removeEventListener(type, handler));
  }

  function currentSpecies() {
    return SPECIES.find(({ id }) => id === selection.species) ?? SPECIES[0];
  }

  function currentExpressionIndex() {
    return Math.max(0, EXPRESSIONS.indexOf(selection.expression));
  }

  function currentOutfit() {
    return OUTFITS.find(({ id }) => id === selection.outfit) ?? OUTFITS[0];
  }

  function currentOutfitSupported() {
    return currentOutfit().supported.includes(selection.species);
  }

  function setStatus(message) {
    if (elements.characterShowcaseStatus) {
      elements.characterShowcaseStatus.textContent = message;
    }
  }

  function selectionSummary() {
    const fitNote = currentOutfitSupported()
      ? "supported fit"
      : "unsupported fit · keep this selection to test fallback";
    return `${currentSpecies().label} · ${titleCase(selection.expression)} · ${currentOutfit().label} · ${fitNote}`;
  }

  function commitAppearance() {
    syncState();
    const result = applyAppearance();
    if (result.applied && result.appearance) onAppearanceChange?.(result.appearance);
    render();
    setStatus(result.applied
      ? `${selectionSummary()} · ${result.mode === "local" ? "appearance applied" : "preview applied"}`
      : `${selectionSummary()} · preview unavailable in this WASM build`);
  }

  function syncState() {
    state.runtime.characterShowcase = {
      ...selection,
      speciesId: currentSpecies().stableId,
      expressionId: selection.expression,
      outfitId: currentOutfit().stableId,
    };
  }

  function render() {
    const speciesContainer = elements.characterShowcaseSpecies;
    const expressionContainer = elements.characterShowcaseExpressions;
    const outfitContainer = elements.characterShowcaseOutfits;
    const motionContainer = elements.characterShowcaseMotion;
    if (!speciesContainer || !expressionContainer || !outfitContainer || !motionContainer) return;

    speciesContainer.replaceChildren(...SPECIES.map((species) => makeButton({
      className: "character-showcase-choice",
      label: species.label,
      detail: species.stableId,
      selected: selection.species === species.id,
      onClick: () => {
        selection.species = species.id;
        commitAppearance();
      },
    })));

    expressionContainer.replaceChildren(...EXPRESSIONS.map((expression) => makeButton({
      className: "character-showcase-choice character-showcase-expression-choice",
      label: titleCase(expression),
      detail: `cuba:expression/${expression}`,
      selected: selection.expression === expression,
      onClick: () => {
        selection.expression = expression;
        commitAppearance();
      },
    })));

    outfitContainer.replaceChildren(...OUTFITS.map((outfit) => {
      const supported = outfit.supported.includes(selection.species);
      const button = makeButton({
        className: "character-showcase-choice character-showcase-outfit-choice",
        label: outfit.label,
        detail: `${outfit.stableId} · hero pairing: ${outfit.pairing}`,
        selected: selection.outfit === outfit.id,
        onClick: () => {
          selection.outfit = outfit.id;
          commitAppearance();
        },
      });
      button.classList.toggle("is-unsupported", !supported);
      return button;
    }));

    motionContainer.replaceChildren(...MOTIONS.map((motion) => makeButton({
      className: "character-showcase-action character-showcase-motion-choice",
      label: motion.label,
      selected: selection.motion === motion.id,
      onClick: () => setMotion(motion.id),
    })));

    if (elements.characterShowcaseExpressionCount) {
      elements.characterShowcaseExpressionCount.textContent = `${currentExpressionIndex() + 1} / ${EXPRESSIONS.length}`;
    }
    if (elements.characterShowcaseOutfitCount) {
      const outfitIndex = Math.max(0, OUTFITS.findIndex(({ id }) => id === selection.outfit));
      elements.characterShowcaseOutfitCount.textContent = `${outfitIndex + 1} / ${OUTFITS.length}`;
    }
    if (elements.characterShowcaseReducedEffects) {
      elements.characterShowcaseReducedEffects.querySelector("span").textContent = selection.reducedEffects
        ? "Reduced effects"
        : "Full effects";
      elements.characterShowcaseReducedEffects.classList.toggle("is-selected", selection.reducedEffects);
      elements.characterShowcaseReducedEffects.disabled = !capabilities.reducedEffects;
      elements.characterShowcaseReducedEffects.title = capabilities.reducedEffects
        ? "Toggle the Rust presentation effects preference"
        : "This Rust build does not expose reduced-effects control";
    }
    if (elements.characterShowcaseQualityNote) {
      elements.characterShowcaseQualityNote.textContent = selection.reducedEffects
        ? "Phase 6 renderer · automatic LOD · reduced seam effects"
        : "Phase 6 renderer · automatic LOD · bounded effects";
    }
  }

  function setMotion(motion) {
    faceCameraActive = false;
    faceCameraPending = false;
    selection.motion = motion;
    MOVEMENT_KEYS.forEach((code) => state.keys.delete(code));
    if (motion === "walk" || motion === "run") state.keys.add("KeyW");
    if (motion === "run") state.keys.add("ShiftLeft");
    if (motion === "jump") state.movement.jumpQueued = true;
    syncState();
    render();
    setStatus(`${titleCase(motion)} selected · live movement input is active.`);
  }

  function triggerWave() {
    waveCount += 1;
    if (capabilities.localWave && engine.triggerLocalWave()) {
      setStatus(`Wave ${waveCount} selected.`);
      return;
    }
    setStatus(`Wave ${waveCount} selected · local emotes are unavailable in this engine build.`);
  }

  function toggleReducedEffects() {
    if (!capabilities.reducedEffects) return;
    selection.reducedEffects = !selection.reducedEffects;
    engine.setReducedEffects(selection.reducedEffects);
    syncState();
    render();
    setStatus(selection.reducedEffects ? "Reduced effects enabled." : "Full effects enabled.");
  }

  function faceCamera() {
    faceCameraActive = true;
    faceCameraPending = true;
    selection.motion = "idle";
    MOVEMENT_KEYS.forEach((code) => state.keys.delete(code));
    // The engine derives an idle player's facing from the camera. Holding
    // reverse input keeps the local character facing the front camera while
    // the showcase is open, without adding a Rust-only orientation API.
    state.keys.add("KeyS");
    syncState();
    render();
    setStatus("Front view ready · the character walks backward to keep its face toward the camera.");
  }

  function openPanel() {
    if (!enabled) return;
    open = true;
    elements.characterShowcasePanel.hidden = false;
    elements.characterShowcaseLauncher?.setAttribute("aria-expanded", "true");
    elements.characterShowcaseLauncher?.setAttribute("aria-label", "Close character lab");
  }

  function closePanel() {
    if (!enabled) return;
    open = false;
    faceCameraActive = false;
    faceCameraPending = false;
    state.keys.delete("KeyS");
    elements.characterShowcasePanel.hidden = true;
    elements.characterShowcaseLauncher?.setAttribute("aria-expanded", "false");
    elements.characterShowcaseLauncher?.setAttribute("aria-label", "Open character lab");
  }

  function togglePanel() {
    if (open) closePanel();
    else openPanel();
  }

  function handleKeyboard(event) {
    if (!enabled) return false;
    if (event.key === "?" || (event.code === "Slash" && event.shiftKey)) {
      event.preventDefault();
      togglePanel();
      return true;
    }
    if (!open) return false;
    if (event.repeat) {
      const showcaseKey = ["Digit1", "Digit2", "Digit3", "KeyE", "KeyO", "KeyH", "KeyF"].includes(event.code);
      if (showcaseKey) event.preventDefault();
      return showcaseKey;
    }
    if (event.code === "Digit1" || event.code === "Digit2" || event.code === "Digit3") {
      event.preventDefault();
      const species = SPECIES[Number(event.code.slice(-1)) - 1];
      species && selectSpecies(species.id);
      return true;
    }
    if (event.code === "KeyE") {
      event.preventDefault();
      cycleExpression(event.shiftKey ? -1 : 1);
      return true;
    }
    if (event.code === "KeyO") {
      event.preventDefault();
      cycleOutfit(event.shiftKey ? -1 : 1);
      return true;
    }
    if (event.code === "KeyH") {
      event.preventDefault();
      triggerWave();
      return true;
    }
    if (event.code === "KeyF") {
      event.preventDefault();
      faceCamera();
      return true;
    }
    return false;
  }

  function selectSpecies(id) {
    if (!SPECIES.some((species) => species.id === id)) return;
    selection.species = id;
    commitAppearance();
  }

  function cycleExpression(direction) {
    const index = (currentExpressionIndex() + direction + EXPRESSIONS.length) % EXPRESSIONS.length;
    selection.expression = EXPRESSIONS[index];
    commitAppearance();
  }

  function cycleOutfit(direction) {
    const index = Math.max(0, OUTFITS.findIndex(({ id }) => id === selection.outfit));
    selection.outfit = OUTFITS[(index + direction + OUTFITS.length) % OUTFITS.length].id;
    commitAppearance();
  }

  function update() {
    if (!enabled || !state.runtime.engineFrame) return;
    if (faceCameraActive) state.keys.add("KeyS");
    if (faceCameraPending) {
      const { camera } = state.runtime.engineFrame;
      const yawDelta = shortestAngle(Math.PI - camera.yaw);
      state.movement.lookX += -yawDelta / LOOK_SENSITIVITY;
      state.movement.zoomDelta += SHOWCASE_CAMERA_DISTANCE - camera.distance;
      faceCameraPending = false;
    }
    if (selection.motion === "jump" && state.runtime.engineFrame.player.grounded) {
      selection.motion = "idle";
      render();
    }
  }

  if (!enabled) {
    return {
      handleKeyboard: () => false,
      update() {},
      destroy() {},
    };
  }

  elements.characterShowcaseLauncher.hidden = false;
  render();
  syncState();
  setStatus(capabilities.localAppearance
    ? "Client selector ready · Phase 7 local appearance API is active."
    : "Client selector ready · Phase 5 appearance schema with Phase 6 renderer quality.");

  listen(elements.characterShowcaseLauncher, "click", togglePanel);
  listen(elements.characterShowcaseClose, "click", closePanel);
  listen(elements.characterShowcaseWave, "click", triggerWave);
  listen(elements.characterShowcaseReducedEffects, "click", toggleReducedEffects);
  listen(elements.characterShowcaseFaceCamera, "click", faceCamera);

  return {
    handleKeyboard,
    update,
    destroy() {
      removeListeners.splice(0).forEach((remove) => remove());
      MOVEMENT_KEYS.forEach((code) => state.keys.delete(code));
      faceCameraActive = false;
      faceCameraPending = false;
      state.runtime.characterShowcase = null;
    },
  };
}
