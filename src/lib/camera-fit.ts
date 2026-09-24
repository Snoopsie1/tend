// Camera distances for the garden. Pure math, so it runs in tests.

// Screens wider than this keep the distance they would have at this aspect,
// so a desktop does not zoom in on the front row.
export const FIT_ASPECT = 1.3;

const tanHalf = (vfovDeg: number) => Math.tan((vfovDeg * Math.PI) / 360);

// A phone's front heads are only ~26 px, so the rows fade out within about
// twice the front distance. Seen at 32°, that depth fills a thin band under
// an empty sky. Tall screens look down more steeply, so the same rows spread
// over the whole height.
const LANDSCAPE_PITCH = 32;
const PORTRAIT_PITCH = 55;
const PORTRAIT_ASPECT = 390 / 844;

// The camera's angle above the front row, in radians.
export function pitchFor(aspect: number) {
  const t = Math.min(Math.max((FIT_ASPECT - aspect) / (FIT_ASPECT - PORTRAIT_ASPECT), 0), 1);
  return ((LANDSCAPE_PITCH + t * (PORTRAIT_PITCH - LANDSCAPE_PITCH)) * Math.PI) / 180;
}

// Distance from the camera to the front row where rowWidth + 2 * margin
// fills the screen width.
export function fitDistance(aspect: number, vfovDeg: number, rowWidth: number, margin: number) {
  return (rowWidth / 2 + margin) / (Math.min(aspect, FIT_ASPECT) * tanHalf(vfovDeg));
}

// CSS pixels that a world size covers at a view depth.
export function pixelSizeAtDepth(size: number, depth: number, vfovDeg: number, viewportHeightCss: number) {
  return (size * viewportHeightCss) / (2 * depth * tanHalf(vfovDeg));
}

// View depth where a world size shrinks to px CSS pixels.
export function depthForPixelSize(size: number, px: number, vfovDeg: number, viewportHeightCss: number) {
  return (size * viewportHeightCss) / (2 * px * tanHalf(vfovDeg));
}
