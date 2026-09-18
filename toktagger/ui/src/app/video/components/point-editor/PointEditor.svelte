<script lang="ts">
  import type { Ellipse, Transform } from "@annotorious/annotorious";
  import { POINT_MARKER } from "./marker-style";

  type Props = {
    shape: Ellipse;
    computedStyle?: string;
    transform: Transform;
    viewportScale?: number;
    svgEl?: SVGSVGElement;
    onchange?: (shape: Ellipse) => void;
    ongrab?: (event: PointerEvent) => void;
    onrelease?: (event: PointerEvent) => void;
  };

  let {
    shape,
    transform,
    viewportScale = 1,
    svgEl,
    onchange,
    ongrab,
    onrelease,
  }: Props = $props();

  let grabbedPointerId: number | null = null;
  let origin: [number, number] | null = null;
  let initialShape: Ellipse | null = null;
  let captureTarget: SVGElement | null = null;

  const geometry = $derived(shape.geometry);
  const scale = $derived(Math.max(viewportScale, 0.0001));
  const ringRadius = $derived(POINT_MARKER.selectedRingRadiusPx / scale);
  const hitRadius = $derived(POINT_MARKER.hitRadiusPx / scale);
  const centerDotRadius = $derived(POINT_MARKER.centerDotRadiusPx / scale);

  const eventToImagePoint = (event: PointerEvent): [number, number] => {
    if (svgEl) {
      const bounds = svgEl.getBoundingClientRect();
      return transform.elementToImage(
        event.clientX - bounds.left,
        event.clientY - bounds.top,
      );
    }

    return transform.elementToImage(event.offsetX, event.offsetY);
  };

  const translateShape = (
    ellipse: Ellipse,
    deltaX: number,
    deltaY: number,
  ): Ellipse => {
    const { geometry: ellipseGeometry } = ellipse;

    return {
      ...ellipse,
      geometry: {
        ...ellipseGeometry,
        cx: ellipseGeometry.cx + deltaX,
        cy: ellipseGeometry.cy + deltaY,
        bounds: {
          minX: ellipseGeometry.bounds.minX + deltaX,
          minY: ellipseGeometry.bounds.minY + deltaY,
          maxX: ellipseGeometry.bounds.maxX + deltaX,
          maxY: ellipseGeometry.bounds.maxY + deltaY,
        },
      },
    };
  };

  const grabShape = (event: PointerEvent) => {
    if (event.button !== 0) return;

    grabbedPointerId = event.pointerId;
    origin = eventToImagePoint(event);
    initialShape = shape;
    captureTarget =
      event.currentTarget instanceof SVGElement
        ? event.currentTarget
        : event.target instanceof SVGElement
          ? event.target
          : null;

    captureTarget?.setPointerCapture(event.pointerId);
    ongrab?.(event);
  };

  const moveShape = (event: PointerEvent) => {
    if (
      grabbedPointerId !== event.pointerId ||
      origin === null ||
      initialShape === null
    ) {
      return;
    }

    const [x, y] = eventToImagePoint(event);
    onchange?.(translateShape(initialShape, x - origin[0], y - origin[1]));
  };

  const releaseShape = (event: PointerEvent) => {
    if (grabbedPointerId !== event.pointerId) return;

    if (captureTarget?.hasPointerCapture(event.pointerId)) {
      captureTarget.releasePointerCapture(event.pointerId);
    }

    grabbedPointerId = null;
    origin = null;
    initialShape = null;
    captureTarget = null;

    onrelease?.(event);
  };
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<g
  class="a9s-annotation selected point-editor"
  onpointermove={moveShape}
  onpointerup={releaseShape}
  onpointercancel={releaseShape}
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <ellipse
    class="point-marker-hit-target a9s-shape-handle"
    onpointerdown={grabShape}
    cx={geometry.cx}
    cy={geometry.cy}
    rx={hitRadius}
    ry={hitRadius}
  />

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <ellipse
    class="point-marker-ring a9s-shape-handle"
    onpointerdown={grabShape}
    cx={geometry.cx}
    cy={geometry.cy}
    rx={ringRadius}
    ry={ringRadius}
    style:fill={POINT_MARKER.selectedRingFill}
    style:stroke={POINT_MARKER.selectedRingStroke}
    style:stroke-width={`${POINT_MARKER.selectedRingStrokeWidthPx}px`}
  />

  <circle
    class="point-marker-center-dot"
    cx={geometry.cx}
    cy={geometry.cy}
    r={centerDotRadius}
    style:fill={POINT_MARKER.centerDotFill}
    style:stroke={POINT_MARKER.centerDotStroke}
    style:stroke-width={`${POINT_MARKER.centerDotStrokeWidthPx}px`}
  />
</g>

<style>
  .point-marker-hit-target {
    fill: transparent;
    pointer-events: all;
    stroke: transparent;
    stroke-width: 0;
  }

  .point-marker-ring {
    pointer-events: all;
    vector-effect: non-scaling-stroke;
  }

  .point-marker-center-dot {
    pointer-events: none;
    vector-effect: non-scaling-stroke;
  }
</style>
