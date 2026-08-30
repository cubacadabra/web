export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function damp(THREE, current, target, smoothing, delta) {
  return THREE.MathUtils.lerp(
    current,
    target,
    1 - Math.exp(-smoothing * delta),
  );
}
