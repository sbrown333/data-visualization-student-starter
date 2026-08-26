import { useEffect, useRef } from 'react';
import { select } from 'd3-selection';
import { scaleLinear } from 'd3-scale';
import { useDimensions } from './useDimensions';

interface DataPoint {
  x: number;
  y: number;
}

const data: DataPoint[] = [
  { x: 100, y: 100 },
  { x: 250, y: 300 },
  { x: 400, y: 200 },
  { x: 550, y: 350 },
  { x: 700, y: 150 },
  { x: 850, y: 280 },
];

const ORIGINAL_WIDTH = 960;
const ORIGINAL_HEIGHT = 500;

export function ResponsivePseudoScatterPlot() {
  const svgRef = useRef<SVGSVGElement>(null);

  const { ref: divRef, dimensions } = useDimensions();

  useEffect(() => {
    const svg = svgRef.current;

    if (
      !svg ||
      dimensions.width === 0 ||
      dimensions.height === 0
    ) {
      return;
    }

    const xScale = scaleLinear()
      .domain([0, ORIGINAL_WIDTH])
      .range([0, dimensions.width]);

    const yScale = scaleLinear()
      .domain([0, ORIGINAL_HEIGHT])
      .range([0, dimensions.height]);

    select(svg)
      .selectAll('path')
      .data(data)
      .join('path')

      // Creates a triangle instead of a circle
      .attr('d', 'M 0 -20 L 18 15 L -18 15 Z')

      // Positions each triangle
      .attr(
        'transform',
        (d) =>
          `translate(${xScale(d.x)}, ${yScale(d.y)})`,
      )

      // Small creative change
      .attr('fill', 'purple');
  }, [dimensions]);

  return (
    <div
      ref={divRef}
      className="relative w-full h-full"
    >
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full"
        role="img"
        aria-label="Responsive pseudo scatter plot using triangles"
      ></svg>
    </div>
  );
}