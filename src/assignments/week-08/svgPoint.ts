// Position of a pointer event inside an SVG group, in the SVG's own units.
export function localPoint(e: import("react").PointerEvent, g: SVGGElement | null): [number, number] | null {
  const svg = g?.ownerSVGElement;
  const ctm = g?.getScreenCTM();
  if (!svg || !ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const p = pt.matrixTransform(ctm.inverse());
  return [p.x, p.y];
}
