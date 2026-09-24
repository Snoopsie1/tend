import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { Fog, PerspectiveCamera } from "three";
import { depthForPixelSize, fitDistance, pitchFor, pixelSizeAtDepth } from "@/lib/camera-fit";
import { ROW_WIDTH } from "@/lib/layout";
import { HEAD_SIZE } from "@/lib/species";

const MARGIN = 0.2;
// The front row sits this far below the screen center, as a share of half
// the vertical fov, so the older days fill most of the screen.
const FRONT_BELOW_CENTER = 0.7;
const MAX_YAW = Math.PI / 6;
const YAW_PER_PX = 0.005;
const MIN_ZOOM = 0.7;
const MAX_ZOOM = 1.5;
// Rows fade into the paper where a flower head drops under this size.
const FADE_PX = 12;
// Inertia decay per second.
const DECAY = 6;

type Controller = {
  // World units behind today, 0 = today at the front.
  scroll: number;
  yaw: number;
  zoom: number;
  // Scroll speed in world units per second, for inertia.
  velocity: number;
  lastMove: number;
  // Ground distance per CSS pixel of vertical drag at the front row.
  unitsPerPx: number;
  pointers: Map<number, { x: number; y: number }>;
  pinchSpan: number | null;
};

const createController = (): Controller => ({
  scroll: 0,
  yaw: 0,
  zoom: 1,
  velocity: 0,
  lastMove: 0,
  unitsPerPx: 0.01,
  pointers: new Map(),
  pinchSpan: null,
});

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

// Scrolls through time along the garden, turns up to 30° each way and zooms
// within limits. The camera keeps one row filling the screen width.
export default function CameraController({ depth }: { depth: number }) {
  const gl = useThree((state) => state.gl);
  // Mutable state that never drives a render, so it lives in a ref. Only the
  // effect and the frame callback read it.
  const ref = useRef(createController());

  useEffect(() => {
    const ctl = ref.current;
    const canvas = gl.domElement;
    const span = () => {
      const [a, b] = [...ctl.pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    // Never stop propagation here. R3F listens on the parent for its clicks.
    const down = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      ctl.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      ctl.velocity = 0;
      ctl.pinchSpan = ctl.pointers.size === 2 ? span() : null;
    };

    const move = (e: PointerEvent) => {
      const last = ctl.pointers.get(e.pointerId);
      if (!last) return;
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      last.x = e.clientX;
      last.y = e.clientY;
      if (ctl.pointers.size === 1) {
        // Dragging down pulls the ground closer, so older days come forward.
        const step = dy * ctl.unitsPerPx;
        ctl.scroll = clamp(ctl.scroll + step, 0, depth);
        ctl.yaw = clamp(ctl.yaw - dx * YAW_PER_PX, -MAX_YAW, MAX_YAW);
        const seconds = Math.max(e.timeStamp - ctl.lastMove, 1) / 1000;
        ctl.velocity = 0.8 * (step / seconds) + 0.2 * ctl.velocity;
        ctl.lastMove = e.timeStamp;
      } else if (ctl.pointers.size === 2 && ctl.pinchSpan) {
        const next = span();
        ctl.zoom = clamp((ctl.zoom * ctl.pinchSpan) / next, MIN_ZOOM, MAX_ZOOM);
        ctl.pinchSpan = next;
      }
    };

    const up = (e: PointerEvent) => {
      if (!ctl.pointers.delete(e.pointerId)) return;
      // A finger that rests before it lifts leaves no inertia.
      if (e.timeStamp - ctl.lastMove > 80) ctl.velocity = 0;
      ctl.pinchSpan = ctl.pointers.size === 2 ? span() : null;
    };

    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey) {
        ctl.zoom = clamp(ctl.zoom * Math.exp(e.deltaY * 0.01), MIN_ZOOM, MAX_ZOOM);
      } else {
        ctl.velocity = 0;
        ctl.scroll = clamp(ctl.scroll + e.deltaY * ctl.unitsPerPx, 0, depth);
      }
    };

    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("lostpointercapture", up);
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("lostpointercapture", up);
      canvas.removeEventListener("wheel", wheel);
    };
  }, [gl, depth]);

  useFrame(({ camera, size, scene }, delta) => {
    const ctl = ref.current;
    const fov = (camera as PerspectiveCamera).fov;
    if (ctl.pointers.size === 0 && ctl.velocity !== 0) {
      ctl.scroll = clamp(ctl.scroll + ctl.velocity * delta, 0, depth);
      ctl.velocity *= Math.exp(-DECAY * delta);
      if (Math.abs(ctl.velocity) < 0.01) ctl.velocity = 0;
    }

    const aspect = size.width / size.height;
    const pitch = pitchFor(aspect);
    const distance = fitDistance(aspect, fov, ROW_WIDTH, MARGIN) * ctl.zoom;
    const flat = distance * Math.cos(pitch);
    camera.position.set(flat * Math.sin(ctl.yaw), distance * Math.sin(pitch), -ctl.scroll + flat * Math.cos(ctl.yaw));
    const look = pitch - (FRONT_BELOW_CENTER * fov * Math.PI) / 360;
    camera.lookAt(
      camera.position.x - Math.sin(ctl.yaw) * Math.cos(look),
      camera.position.y - Math.sin(look),
      camera.position.z - Math.cos(ctl.yaw) * Math.cos(look),
    );

    // One pixel of drag moves the ground one pixel at the front row.
    ctl.unitsPerPx = 1 / (pixelSizeAtDepth(1, distance, fov, size.height) * Math.sin(pitch));

    const fog = scene.fog as Fog;
    fog.far = depthForPixelSize(HEAD_SIZE, FADE_PX, fov, size.height);
    fog.near = Math.min(distance + 0.4 * (fog.far - distance), 0.9 * fog.far);
  });

  return null;
}
