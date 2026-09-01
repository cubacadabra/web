export function createEnvironment({ THREE, scene, world, gameDefinition }) {
  const colors = gameDefinition.palette;
  const worldDefinition = gameDefinition.world ?? {};

  function colorToCss(color) {
    return `#${color.toString(16).padStart(6, "0")}`;
  }

  function createBlock(position, size, color, options = {}) {
    const geometry = new THREE.BoxGeometry(...size);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: options.roughness ?? 0.86,
      metalness: 0,
    });
    const block = new THREE.Mesh(geometry, material);
    block.position.set(...position);
    block.castShadow = true;
    block.receiveShadow = true;
    world.add(block);

    if (options.outline !== false) {
      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({
          color: colors.paper,
          transparent: true,
          opacity: 0.22,
        }),
      );
      block.add(outline);
    }

    return block;
  }

  function createSpawnPad() {
    const pad = new THREE.Group();
    pad.position.set(...(worldDefinition.spawn ?? [0, 0, 6.25]));

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(2.45, 2.45, 0.18, 32),
      new THREE.MeshStandardMaterial({ color: colors.ink, roughness: 0.92 }),
    );
    base.position.y = 0.11;
    base.castShadow = true;
    base.receiveShadow = true;
    pad.add(base);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.78, 0.055, 8, 32),
      new THREE.MeshBasicMaterial({
        color: colors.paper,
        transparent: true,
        opacity: 0.52,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.23;
    pad.add(ring);

    const center = new THREE.Mesh(
      new THREE.CircleGeometry(1.35, 32),
      new THREE.MeshBasicMaterial({
        color: colors.ink,
        transparent: true,
        opacity: 0.32,
        side: THREE.DoubleSide,
      }),
    );
    center.rotation.x = -Math.PI / 2;
    center.position.y = 0.205;
    pad.add(center);

    world.add(pad);
    return pad;
  }

  function createWorldLabel(text, accent) {
    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = 420;
    labelCanvas.height = 96;
    const context = labelCanvas.getContext("2d");
    context.fillStyle = colorToCss(colors.ink);
    context.globalAlpha = 0.92;
    context.fillRect(3, 3, 414, 90);
    context.globalAlpha = 1;
    context.fillStyle = `#${accent.toString(16).padStart(6, "0")}`;
    context.fillRect(3, 3, 7, 90);
    context.fillStyle = colorToCss(colors.paper);
    context.font = "800 25px Arial, sans-serif";
    context.letterSpacing = "2px";
    context.fillText(text, 30, 58);

    const texture = new THREE.CanvasTexture(labelCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    }));
    label.scale.set(4.1, 0.94, 1);
    label.position.y = 4.55;
    return label;
  }

  function createLaunchPad(launchPad) {
    const { position, color, label, code } = launchPad;
    const point = new THREE.Group();
    point.position.set(position[0], position[1] ?? 0, position[2] ?? 0);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(launchPad.radius + 0.45, launchPad.radius + 0.45, 0.2, 32),
      new THREE.MeshStandardMaterial({ color: colors.ink, roughness: 0.9 }),
    );
    base.position.y = 0.1;
    base.receiveShadow = true;
    point.add(base);

    const inner = new THREE.Mesh(
      new THREE.CircleGeometry(launchPad.radius, 32),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
      }),
    );
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = 0.215;
    point.add(inner);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(Math.max(0.2, launchPad.radius - 0.15), 0.11, 8, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.28;
    point.add(ring);

    const beacons = [];
    [-2.35, 2.35].forEach((x) => {
      const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.23, 2.7, 8),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.18,
        }),
      );
      beacon.position.set(x, 1.35, -0.35);
      beacon.castShadow = true;
      point.add(beacon);
      beacons.push(beacon);
    });

    const portalTop = new THREE.Mesh(
      new THREE.BoxGeometry(5.05, 0.32, 0.38),
      new THREE.MeshStandardMaterial({ color, roughness: 0.8 }),
    );
    portalTop.position.set(0, 2.62, -0.35);
    portalTop.castShadow = true;
    point.add(portalTop);

    point.add(createWorldLabel(`${code}  ${label}`, color));
    world.add(point);
    return {
      code,
      label,
      color,
      group: point,
      position: new THREE.Vector3(point.position.x, point.position.y, point.position.z),
      ring,
      beacons,
    };
  }

  function createCloud(position, scale) {
    const cloud = new THREE.Group();
    cloud.position.set(...position);
    cloud.scale.setScalar(scale);
    cloud.userData.initialX = cloud.position.x;

    const cloudMaterial = new THREE.MeshBasicMaterial({
      color: colors.paper,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    });

    [
      [-1.1, 0, 0, 1.1],
      [0, 0.24, 0, 1.45],
      [1.1, 0.02, 0, 0.92],
      [0.42, -0.15, 0.08, 1.05],
    ].forEach(([x, y, z, radius]) => {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 12, 8),
        cloudMaterial,
      );
      puff.position.set(x, y, z);
      cloud.add(puff);
    });

    scene.add(cloud);
    return cloud;
  }

  const groundSize = worldDefinition.groundSize ?? 120;
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(groundSize, 0.7, groundSize),
    new THREE.MeshStandardMaterial({
      color: colors.ground,
      roughness: 1,
      metalness: 0,
    }),
  );
  ground.position.y = -0.35;
  ground.receiveShadow = true;
  world.add(ground);

  const groundEdge = new THREE.LineSegments(
    new THREE.EdgesGeometry(ground.geometry),
    new THREE.LineBasicMaterial({
      color: colors.groundEdge,
      transparent: true,
      opacity: 0.28,
    }),
  );
  groundEdge.position.copy(ground.position);
  world.add(groundEdge);

  const gridSize = worldDefinition.gridSize ?? 112;
  const grid = new THREE.GridHelper(
    gridSize,
    worldDefinition.gridDivisions ?? 28,
    colors.grid,
    colors.grid,
  );
  grid.position.y = 0.012;
  grid.material.transparent = true;
  grid.material.opacity = 0.22;
  grid.material.depthWrite = false;
  world.add(grid);

  const spawnPad = createSpawnPad();
  const renderedLaunchPads = (gameDefinition.launchPads ?? []).map(createLaunchPad);
  const blocks = (gameDefinition.blocks ?? []).map((block) => createBlock(
    block.position,
    block.size,
    block.color,
    block,
  ));
  const clouds = (worldDefinition.clouds ?? []).map((cloud) => createCloud(
    cloud.position,
    cloud.scale,
  ));

  return {
    animated: {
      spawnPad,
      blocks,
      clouds,
      launchPads: renderedLaunchPads,
    },
    launchPads: renderedLaunchPads,
  };
}
