// The metallic 3D Spanlyfy emblem that anchors the hero. Edges are feathered with a radial
// mask so the source image's square background melts into the hero's warm gradient. Static.
export function HeroArt() {
  const mask = "radial-gradient(72% 76% at 52% 50%, #000 64%, transparent 100%)";

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/hero-emblem-3d.png"
      alt="Spanlyfy"
      className="h-full w-full select-none object-contain object-center"
      style={{ WebkitMaskImage: mask, maskImage: mask }}
      draggable={false}
    />
  );
}
