import {
  mount,
  unmount,
  type ComponentConstructorOptions,
  type SvelteComponent,
} from "svelte";
import type { Ellipse, Transform } from "@annotorious/annotorious";

import PointEditor from "./PointEditor.svelte";

/** Properties Annotorious passes to a registered shape editor. */
export interface PointEditorProps {
  shape: Ellipse;
  computedStyle?: string;
  transform: Transform;
  viewportScale?: number;
  svgEl?: SVGSVGElement;
}

type PointEditorComponentProps = PointEditorProps & {
  onchange: (shape: Ellipse) => void;
  ongrab: (event: PointerEvent) => void;
  onrelease: (event: PointerEvent) => void;
};

type PointEditorEventDetails = {
  change: Ellipse;
  grab: PointerEvent;
  release: PointerEvent;
};

type PointEditorEvents = {
  [EventName in keyof PointEditorEventDetails]: CustomEvent<
    PointEditorEventDetails[EventName]
  >;
};

// Preserve the relationship between each event name and its detail while narrowing.
type PointEditorEventArguments = {
  [EventName in keyof PointEditorEventDetails]: [
    eventName: EventName,
    detail: PointEditorEventDetails[EventName],
  ];
}[keyof PointEditorEventDetails];

/** Adapts the Svelte 5 editor to Annotorious' Svelte component contract. */
export class PointEditorHost implements SvelteComponent<
  PointEditorProps,
  PointEditorEvents
> {
  [propertyName: string]: unknown;

  declare $$prop_def: PointEditorProps;
  declare $$events_def: PointEditorEvents;
  declare $$slot_def: Record<string, never>;

  #props: PointEditorComponentProps;
  #instance: ReturnType<typeof mount>;
  #handlers: {
    [EventName in keyof PointEditorEvents]: Set<
      (event: PointEditorEvents[EventName]) => void
    >;
  } = {
    change: new Set(),
    grab: new Set(),
    release: new Set(),
  };
  #destroyed = false;

  constructor(options: ComponentConstructorOptions<PointEditorProps>) {
    if (!options.props) {
      throw new Error("Annotorious must provide point editor properties.");
    }

    this.#props = $state({
      ...options.props,
      onchange: (shape) => this.#emit("change", shape),
      ongrab: (event) => this.#emit("grab", event),
      onrelease: (event) => this.#emit("release", event),
    });

    this.#instance = mount(PointEditor, {
      target: options.target,
      props: this.#props,
    });
  }

  #emit(...[eventName, detail]: PointEditorEventArguments) {
    switch (eventName) {
      case "change": {
        const event = new CustomEvent("change", { detail });
        for (const handler of this.#handlers.change) {
          handler(event);
        }
        return;
      }
      case "grab": {
        const event = new CustomEvent("grab", { detail });
        for (const handler of this.#handlers.grab) {
          handler(event);
        }
        return;
      }
      case "release": {
        const event = new CustomEvent("release", { detail });
        for (const handler of this.#handlers.release) {
          handler(event);
        }
        return;
      }
    }

    eventName satisfies never;
  }

  $set(props: Partial<PointEditorProps>) {
    if (this.#destroyed) return;
    Object.assign(this.#props, props);
  }

  /** Annotorious echoes changed shapes through $$set after each editor event. */
  $$set(props: Partial<PointEditorProps>) {
    this.$set(props);
  }

  $on<EventName extends keyof PointEditorEvents>(
    eventName: EventName,
    handler: (event: PointEditorEvents[EventName]) => void,
  ) {
    const handlers = this.#handlers[eventName];
    handlers.add(handler);

    return () => {
      handlers.delete(handler);
    };
  }

  $destroy() {
    if (this.#destroyed) return;

    this.#destroyed = true;
    this.#handlers.change.clear();
    this.#handlers.grab.clear();
    this.#handlers.release.clear();
    void unmount(this.#instance);
  }
}
