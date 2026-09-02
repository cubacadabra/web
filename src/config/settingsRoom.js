const settingsRoomBlocks = [
  { position: [17.8, 2.25, -3.7], size: [1, 4.5, 1], color: "ink" },
  { position: [22.2, 2.25, -3.7], size: [1, 4.5, 1], color: "ink" },
  { position: [20, 4.25, -3.7], size: [3.4, 0.8, 1], color: "ink" },
  { position: [20, 3.7, -3.12], size: [0.72, 0.72, 0.22], color: "butter", outline: false },
  { position: [20, 4.2, -3.12], size: [0.24, 0.32, 0.22], color: "butter", outline: false },
  { position: [20, 3.35, -3.12], size: [0.24, 0.32, 0.22], color: "butter", outline: false },
  { position: [19.43, 3.7, -3.12], size: [0.32, 0.24, 0.22], color: "butter", outline: false },
  { position: [20.57, 3.7, -3.12], size: [0.32, 0.24, 0.22], color: "butter", outline: false },
];

export const settingsRoomConfig = {
  bounds: {
    minX: 17.1,
    maxX: 22.9,
    minZ: -8.5,
    maxZ: -3.05,
  },
  proximityRadius: 7,
  blocks: settingsRoomBlocks,
};

export function addWebSettingsRoom(manifest) {
  return {
    ...manifest,
    blocks: [...(manifest.blocks ?? []), ...settingsRoomBlocks],
    settingsRoom: settingsRoomConfig,
  };
}
