export function createEnvironment({ THREE, scene, world, colors }) {
  const obstacles = [];

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

    if (options.collidable !== false) {
      obstacles.push({
        minX: position[0] - size[0] / 2,
        maxX: position[0] + size[0] / 2,
        minZ: position[2] - size[2] / 2,
        maxZ: position[2] + size[2] / 2,
        bottom: position[1] - size[1] / 2,
        top: position[1] + size[1] / 2,
      });
    }

    return block;
  }

  function createSpawnPad() {
    const pad = new THREE.Group();
    pad.position.set(0, 0, 6.25);

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(2.45, 2.45, 0.18, 32),
      new THREE.MeshStandardMaterial({
        color: colors.ink,
        roughness: 0.92,
      }),
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

  function createCloud(position, scale) {
    const cloud = new THREE.Group();
    cloud.position.set(...position);
    cloud.scale.setScalar(scale);

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

  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(120, 0.7, 120),
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

  const grid = new THREE.GridHelper(112, 28, colors.grid, colors.grid);
  grid.position.y = 0.012;
  grid.material.transparent = true;
  grid.material.opacity = 0.22;
  grid.material.depthWrite = false;
  world.add(grid);

  const spawnPad = createSpawnPad();
  const coralBlock = createBlock(
    [0.15, 1.35, -13.5],
    [2.8, 2.7, 2.8],
    colors.coral,
  );
  const butterBlock = createBlock(
    [-8.1, 0.8, -22],
    [3.8, 1.6, 3.8],
    colors.butter,
  );
  const blueBlock = createBlock(
    [8.4, 1.5, -27],
    [2.2, 3, 2.2],
    colors.periwinkle,
  );
  createBlock([13, 0.5, -17], [1, 1, 1], colors.ink, {
    outline: false,
  });

  // A handful of soft horizon markers keep the world readable while it stays sparse.
  createBlock([-22, 0.35, -34], [1.2, 0.7, 1.2], colors.coral, {
    outline: false,
  });
  createBlock([24, 0.5, -39], [1.5, 1, 1.5], colors.butter, {
    outline: false,
  });
  createBlock([-28, 0.5, 18], [1.5, 1, 1.5], colors.periwinkle, {
    outline: false,
  });

  const cloudA = createCloud([-18, 18, -55], 1.35);
  const cloudB = createCloud([24, 22, -72], 1.8);
  const cloudC = createCloud([42, 15, 12], 0.95);

  return {
    obstacles,
    animated: {
      spawnPad,
      coralBlock,
      butterBlock,
      blueBlock,
      clouds: [cloudA, cloudB, cloudC],
    },
  };
}
