export function createPlayerAvatar({ THREE, world, colors, palette = {}, visible = false }) {
  function addAvatarPart(parent, size, position, material, options = {}) {
    const geometry = new THREE.BoxGeometry(...size);
    const part = new THREE.Mesh(geometry, material);
    part.position.set(...position);
    part.castShadow = true;
    part.receiveShadow = true;
    parent.add(part);

    if (options.outline !== false) {
      part.add(new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({
          color: colors.paper,
          transparent: true,
          opacity: 0.16,
        }),
      ));
    }

    return part;
  }

  const avatar = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({
    color: palette.skin ?? 0xe8ae86,
    roughness: 0.9,
  });
  const shirt = new THREE.MeshStandardMaterial({
    color: palette.shirt ?? 0x2d6663,
    roughness: 0.88,
  });
  const pants = new THREE.MeshStandardMaterial({
    color: palette.pants ?? 0x536a90,
    roughness: 0.9,
  });
  const shoes = new THREE.MeshStandardMaterial({
    color: palette.shoes ?? 0x293a43,
    roughness: 0.92,
  });
  const face = new THREE.MeshBasicMaterial({ color: colors.ink });

  const torso = addAvatarPart(avatar, [1.1, 1.25, 0.64], [0, 1.82, 0], shirt);
  addAvatarPart(avatar, [0.84, 0.84, 0.84], [0, 3.01, 0], skin);
  const leftArm = addAvatarPart(avatar, [0.36, 1.15, 0.45], [-0.76, 1.84, 0], shirt);
  const rightArm = addAvatarPart(avatar, [0.36, 1.15, 0.45], [0.76, 1.84, 0], shirt);
  const leftLeg = addAvatarPart(avatar, [0.47, 1.25, 0.55], [-0.28, 0.62, 0], pants);
  const rightLeg = addAvatarPart(avatar, [0.47, 1.25, 0.55], [0.28, 0.62, 0], pants);
  addAvatarPart(avatar, [0.56, 0.22, 0.7], [-0.28, 0.11, -0.06], shoes, {
    outline: false,
  });
  addAvatarPart(avatar, [0.56, 0.22, 0.7], [0.28, 0.11, -0.06], shoes, {
    outline: false,
  });
  addAvatarPart(avatar, [0.1, 0.12, 0.03], [-0.16, 3.04, -0.43], face, {
    outline: false,
  });
  addAvatarPart(avatar, [0.1, 0.12, 0.03], [0.16, 3.04, -0.43], face, {
    outline: false,
  });

  avatar.userData.animationParts = { torso, leftArm, rightArm, leftLeg, rightLeg };
  avatar.visible = visible;
  world.add(avatar);
  return avatar;
}
