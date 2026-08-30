export function createScene({ THREE, canvas }) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    canvas,
    powerPreference: "high-performance",
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xc9d9d0, 38, 118);

  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 220);
  camera.position.set(0, 3.4, 11.5);

  const ambientLight = new THREE.HemisphereLight(0xdff0f0, 0x6c866e, 2.25);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xfff2d6, 3.25);
  sunLight.position.set(-24, 30, 18);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 100;
  sunLight.shadow.camera.left = -42;
  sunLight.shadow.camera.right = 42;
  sunLight.shadow.camera.top = 42;
  sunLight.shadow.camera.bottom = -42;
  sunLight.shadow.bias = -0.0008;
  scene.add(sunLight);

  const world = new THREE.Group();
  scene.add(world);

  return { renderer, scene, camera, world };
}
