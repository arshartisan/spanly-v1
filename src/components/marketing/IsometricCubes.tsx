import { cn } from "@/lib/utils";

/**
 * The signature decorative motif from the reference design: a staggered field of isometric
 * cubes. Flat ground tiles are drawn as thin wireframe diamonds; raised tiles become solid
 * extruded cubes (lighter top face + two darker side faces) forming a corner pyramid that
 * rises out of the plane.
 *
 * Pure SVG, deterministic (no random -> no hydration drift). Sizes via `className`
 * (set width/height); the viewBox keeps the cluster centered. `glow` adds a soft halo.
 */

const GRID = 6; // tiles per axis
const W = 34; // half-width of a diamond
const H = 17; // half-height of a diamond (2:1 isometric)
const DU = 30; // pixels of rise per height level

// Corner pyramid: tallest near (0,0), fading to flat at the far edges.
function levelAt(i: number, j: number): number {
  const v = 4 - i - j;
  return v > 0 ? v : 0;
}

type Pt = [number, number];
const pts = (p: Pt[]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

export function IsometricCubes({
  className,
  glow = true,
}: {
  className?: string;
  glow?: boolean;
}) {
  const ox = 250;
  const oy = 70;

  type Tile = { i: number; j: number; sx: number; sy: number; level: number };
  const tiles: Tile[] = [];
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      tiles.push({
        i,
        j,
        sx: ox + (i - j) * W,
        sy: oy + (i + j) * H,
        level: levelAt(i, j),
      });
    }
  }
  // Painter's algorithm: back tiles (small i+j) first, so front cubes occlude correctly.
  tiles.sort((a, b) => a.i + a.j - (b.i + b.j) || a.i - b.i);

  return (
    <svg
      viewBox="0 0 500 420"
      className={cn("h-auto w-full select-none", className)}
      role="img"
      aria-label="Isometric grid of stacked cubes"
    >
      <defs>
        <filter id="cube-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="10" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g filter={glow ? "url(#cube-glow)" : undefined}>
        {tiles.map(({ i, j, sx, sy, level }) => {
          // Ground diamond (z = 0 footprint).
          const gT: Pt = [sx, sy];
          const gR: Pt = [sx + W, sy + H];
          const gB: Pt = [sx, sy + 2 * H];
          const gL: Pt = [sx - W, sy + H];

          if (level === 0) {
            // Flat wireframe tile.
            return (
              <polygon
                key={`${i}-${j}`}
                points={pts([gT, gR, gB, gL])}
                fill="none"
                stroke="hsl(28 90% 55% / 0.28)"
                strokeWidth={1}
              />
            );
          }

          const rise = level * DU;
          const tT: Pt = [sx, sy - rise];
          const tR: Pt = [sx + W, sy + H - rise];
          const tB: Pt = [sx, sy + 2 * H - rise];
          const tL: Pt = [sx - W, sy + H - rise];

          return (
            <g key={`${i}-${j}`}>
              {/* Right face (darkest) */}
              <polygon points={pts([gB, gR, tR, tB])} fill="hsl(18 88% 38%)" />
              {/* Left face (mid) */}
              <polygon points={pts([gL, gB, tB, tL])} fill="hsl(22 90% 47%)" />
              {/* Top face (lightest) */}
              <polygon
                points={pts([tT, tR, tB, tL])}
                fill="hsl(30 96% 62%)"
                stroke="hsl(34 100% 72%)"
                strokeWidth={0.75}
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
