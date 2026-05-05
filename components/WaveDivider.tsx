// Hand-cut wave divider. Layered black silhouette over the previous section.
// Use direction="down" when transitioning into a darker section, "up" when
// transitioning out of one.
export function WaveDivider({
  direction = "down",
  className = "",
}: {
  direction?: "down" | "up";
  className?: string;
}) {
  const path =
    direction === "down"
      ? "M0,40 C160,80 320,0 480,30 C640,60 800,100 960,75 C1120,50 1280,0 1440,30 L1440,120 L0,120 Z"
      : "M0,80 C160,40 320,120 480,90 C640,60 800,20 960,45 C1120,70 1280,120 1440,90 L1440,0 L0,0 Z";
  return (
    <div className={`relative w-full leading-[0] ${className}`} aria-hidden>
      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="block w-full h-[60px] sm:h-[90px] text-ink"
      >
        <path d={path} fill="currentColor" />
      </svg>
    </div>
  );
}
