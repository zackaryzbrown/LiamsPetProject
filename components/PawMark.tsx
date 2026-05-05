export function PawMark({
  className = "",
  size = 20,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden
    >
      <ellipse cx="12" cy="16" rx="5" ry="4" />
      <ellipse cx="5" cy="11" rx="2" ry="2.6" />
      <ellipse cx="19" cy="11" rx="2" ry="2.6" />
      <ellipse cx="9" cy="6" rx="1.8" ry="2.4" />
      <ellipse cx="15" cy="6" rx="1.8" ry="2.4" />
    </svg>
  );
}
