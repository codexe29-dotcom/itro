// ITRO logo — the official "itro" wordmark (teal letters, orange dot, blue→orange
// swirl "o"), served as a transparent PNG so it sits cleanly on any background.

export function Logo({ height = 40, className }: { height?: number; className?: string }) {
  return (
    <img
      src="/itro-logo.png"
      alt="ITRO — Indian Testing & Research Organisation"
      className={className}
      style={{ height, width: "auto" }}
    />
  );
}
