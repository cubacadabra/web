const PALETTES = [
  { shirt: 0xe76f51, pants: 0x355070, skin: 0xf0b18a },
  { shirt: 0x5f8f78, pants: 0x3e5974, skin: 0xd99770 },
  { shirt: 0x748bd2, pants: 0x43515e, skin: 0xf4c39f },
  { shirt: 0xf0b54d, pants: 0x385c62, skin: 0xc98263 },
  { shirt: 0xb276a9, pants: 0x4b5e80, skin: 0xe4a77b },
  { shirt: 0x3f8884, pants: 0x414b5b, skin: 0xf1c29b },
];

export function createNpcManager({ THREE, world, colors, createAvatar }) {
  const avatars = [];

  function ensureAvatar(index) {
    if (avatars[index]) return avatars[index];
    const avatar = createAvatar({
      THREE,
      world,
      colors,
      palette: PALETTES[index % PALETTES.length],
      visible: true,
    });
    avatar.userData.engineAgentIndex = index;
    avatars[index] = avatar;
    return avatar;
  }

  function update(frame) {
    frame.agents.forEach((agent, index) => {
      const avatar = ensureAvatar(index);
      avatar.position.set(
        agent.position.x,
        agent.position.y,
        agent.position.z,
      );
      avatar.rotation.y = agent.yaw;

      const parts = avatar.userData.animationParts;
      const stride = agent.assembled ? 0.03 : Math.sin(agent.walkCycle) * 0.5;
      parts.leftArm.rotation.x = stride;
      parts.rightArm.rotation.x = -stride;
      parts.leftLeg.rotation.x = -stride;
      parts.rightLeg.rotation.x = stride;
      parts.torso.position.y = 1.82 + (
        agent.position.y <= 0.01
          ? Math.abs(Math.sin(agent.walkCycle)) * 0.025
          : 0
      );
    });

    return {
      totalPlayers: frame.totalPlayers,
      meetingCounts: frame.meetingCounts,
      isFull: frame.isFull,
    };
  }

  return { update };
}
