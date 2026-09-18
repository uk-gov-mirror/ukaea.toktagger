import {
  ShapeType,
  type AnnotoriousOpenSeadragonAnnotator,
} from "@annotorious/react";

import { PointEditorHost } from "./point-editor-host.svelte.ts";

export function registerPointEditor(
  api: Pick<AnnotoriousOpenSeadragonAnnotator, "registerShapeEditor">,
) {
  api.registerShapeEditor(ShapeType.ELLIPSE, PointEditorHost);
}
