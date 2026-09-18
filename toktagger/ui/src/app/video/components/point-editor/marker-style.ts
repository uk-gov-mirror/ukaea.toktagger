/** Shared screen-pixel dimensions keep the overlay and editor visually aligned. */
export const POINT_MARKER = {
  ringRadiusPx: 9,
  selectedRingRadiusPx: 11,
  hitRadiusPx: 13,
  centerDotRadiusPx: 2.25,
  ringStrokeWidthPx: 2,
  selectedRingStrokeWidthPx: 2.5,
  centerDotStrokeWidthPx: 1.25,
  ringFill: "rgba(255, 255, 255, 0.12)",
  selectedRingFill: "rgba(56, 189, 248, 0.18)",
  ringStroke: "#ffffff",
  selectedRingStroke: "#38bdf8",
  centerDotFill: "#ffffff",
  centerDotStroke: "rgba(0, 0, 0, 0.9)",
} as const;
