"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import OpenSeadragon from "openseadragon";
import type {
  AnnotoriousOpenSeadragonAnnotator,
  ImageAnnotation,
} from "@annotorious/react";

import { readPointGeometry } from "@/app/video/components/anno-utils";
import { POINT_MARKER } from "./marker-style";

type MarkerPoint = {
  id: string;
  x: number;
  y: number;
  annotation: ImageAnnotation;
  selected: boolean;
};

export function PointMarkerOverlay(props: {
  api: AnnotoriousOpenSeadragonAnnotator | undefined;
  annotations: ImageAnnotation[];
  selectedAnnotations?: ImageAnnotation[];
  hidden: boolean;
  isEditMode: boolean;
  drawActive: boolean;
  onSelectAnnotation: (annotation: ImageAnnotation) => void;
}) {
  const {
    api,
    annotations,
    selectedAnnotations = [],
    hidden,
    isEditMode,
    drawActive,
    onSelectAnnotation,
  } = props;
  const svgRef = useRef<SVGSVGElement>(null);

  const selectedAnnotationIds = useMemo(
    () => new Set(selectedAnnotations.map((annotation) => annotation.id)),
    [selectedAnnotations],
  );

  const points = useMemo<MarkerPoint[]>(() => {
    if (hidden) return [];

    const annotationsById = new Map<string, ImageAnnotation>();
    for (const annotation of annotations) {
      annotationsById.set(annotation.id, annotation);
    }
    // Selection can contain fresher geometry while an annotation is changing.
    for (const annotation of selectedAnnotations) {
      annotationsById.set(annotation.id, annotation);
    }

    return [...annotationsById.values()].flatMap((annotation) => {
      if (isEditMode && selectedAnnotationIds.has(annotation.id)) return [];

      const geometry = readPointGeometry(annotation);
      if (!geometry) return [];

      return [
        {
          id: annotation.id,
          x: geometry.x,
          y: geometry.y,
          annotation,
          selected: selectedAnnotationIds.has(annotation.id),
        },
      ];
    });
  }, [
    annotations,
    hidden,
    isEditMode,
    selectedAnnotationIds,
    selectedAnnotations,
  ]);

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const markerGroups = d3
      .select(svg)
      .selectAll<SVGGElement, MarkerPoint>("g.point-marker")
      .data(points, (point) => point.id)
      .join(
        (enter) => {
          const groups = enter.append("g").attr("class", "point-marker");

          groups
            .append("circle")
            .attr("class", "point-marker-hit-target")
            .attr("fill", "transparent")
            .attr("stroke", "none");
          groups
            .append("circle")
            .attr("class", "point-marker-ring")
            .attr("fill", POINT_MARKER.ringFill)
            .attr("stroke", POINT_MARKER.ringStroke)
            .attr("stroke-width", POINT_MARKER.ringStrokeWidthPx)
            .style("pointer-events", "none");
          groups
            .append("circle")
            .attr("class", "point-marker-center-dot")
            .attr("fill", POINT_MARKER.centerDotFill)
            .attr("stroke", POINT_MARKER.centerDotStroke)
            .attr("stroke-width", POINT_MARKER.centerDotStrokeWidthPx)
            .style("pointer-events", "none");

          return groups;
        },
        (update) => update,
        (exit) => exit.remove(),
      );

    markerGroups
      .select<SVGCircleElement>("circle.point-marker-hit-target")
      .attr("r", POINT_MARKER.hitRadiusPx)
      .style("pointer-events", drawActive ? "none" : "all")
      .on("pointerdown", function (event: PointerEvent) {
        if (drawActive || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
      })
      .on("pointerup", function (event: PointerEvent, point) {
        if (drawActive || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        onSelectAnnotation(point.annotation);
      });

    markerGroups
      .select<SVGCircleElement>("circle.point-marker-ring")
      .attr("r", (point) =>
        point.selected
          ? POINT_MARKER.selectedRingRadiusPx
          : POINT_MARKER.ringRadiusPx,
      )
      .attr("fill", (point) =>
        point.selected ? POINT_MARKER.selectedRingFill : POINT_MARKER.ringFill,
      )
      .attr("stroke", (point) =>
        point.selected
          ? POINT_MARKER.selectedRingStroke
          : POINT_MARKER.ringStroke,
      )
      .attr("stroke-width", (point) =>
        point.selected
          ? POINT_MARKER.selectedRingStrokeWidthPx
          : POINT_MARKER.ringStrokeWidthPx,
      );
    markerGroups
      .select<SVGCircleElement>("circle.point-marker-center-dot")
      .attr("r", POINT_MARKER.centerDotRadiusPx);

    const updateMarkerPositions = () => {
      const viewer = api?.viewer;
      if (!viewer) return;

      markerGroups.attr("transform", (point) => {
        const screenPoint = viewer.viewport.imageToViewerElementCoordinates(
          new OpenSeadragon.Point(point.x, point.y),
        );
        return `translate(${screenPoint.x} ${screenPoint.y})`;
      });
    };

    updateMarkerPositions();

    const viewer = api?.viewer;
    if (!viewer) return;

    viewer.addHandler("open", updateMarkerPositions);
    viewer.addHandler("viewport-change", updateMarkerPositions);
    viewer.addHandler("animation-finish", updateMarkerPositions);
    viewer.addHandler("resize", updateMarkerPositions);

    return () => {
      viewer.removeHandler("open", updateMarkerPositions);
      viewer.removeHandler("viewport-change", updateMarkerPositions);
      viewer.removeHandler("animation-finish", updateMarkerPositions);
      viewer.removeHandler("resize", updateMarkerPositions);
      markerGroups
        .select<SVGCircleElement>("circle.point-marker-hit-target")
        .on("pointerdown", null)
        .on("pointerup", null);
    };
  }, [api, drawActive, onSelectAnnotation, points]);

  return (
    <svg
      ref={svgRef}
      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      width="100%"
      height="100%"
      aria-hidden="true"
    />
  );
}
