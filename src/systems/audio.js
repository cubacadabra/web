function clampVolume(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}

export function createGameAudio(audioAssets = {}) {
  const templates = new Map();
  const active = new Set();

  for (const [id, definition] of Object.entries(audioAssets)) {
    const template = new Audio(definition.url);
    template.preload = "auto";
    templates.set(id, { template, volume: definition.volume });
  }

  function play(command) {
    if (command?.type !== "play" || typeof command.id !== "string") return false;
    const asset = templates.get(command.id);
    if (!asset) {
      console.warn(`Game requested unknown audio asset "${command.id}".`);
      return false;
    }

    const player = asset.template.cloneNode(true);
    player.volume = clampVolume(asset.volume * clampVolume(command.volume ?? 1));
    active.add(player);
    const release = () => active.delete(player);
    player.addEventListener("ended", release, { once: true });
    player.addEventListener("error", release, { once: true });
    player.play().catch(release);
    return true;
  }

  function destroy() {
    for (const player of active) {
      player.pause();
      player.removeAttribute("src");
      player.load();
    }
    active.clear();
    templates.clear();
  }

  return { play, destroy };
}
