import type { Annotation } from "@annotorious/core";
import type { ImageAnnotation, ShapeType } from "@annotorious/annotorious";
import type { ComponentConstructorOptions, SvelteComponent } from "svelte";

declare module "@annotorious/openseadragon" {
  interface OpenSeadragonAnnotator<
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Must match the dependency declaration.
    I extends Annotation = ImageAnnotation,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Must match the dependency declaration.
    E extends unknown = ImageAnnotation,
  > {
    registerShapeEditor<
      Props extends SvelteComponent["$$prop_def"],
      Events extends SvelteComponent["$$events_def"],
      Slots extends SvelteComponent["$$slot_def"],
      Component extends SvelteComponent<Props, Events, Slots>,
    >(
      shapeType: ShapeType,
      editor: new (options: ComponentConstructorOptions<Props>) => Component,
    ): void;
  }
}
