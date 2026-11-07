import { useEffect, useState } from "react";

export interface HeroSlide {
  src: string;
  label: string;
}

/**
 * Full-bleed hero slideshow. Each image enters from a different direction
 * (top, right, bottom, left, cycling) with a crossfade, so successive slides
 * feel varied rather than a single left-to-right slide. The incoming image
 * slides in on top of the outgoing one. A small industry caption updates with
 * each slide. Overlays blend the image into the white page (no boxed frame).
 */
const OFFSETS = [
  "translateY(-100%)", // enters from the top
  "translateX(100%)",  // from the right
  "translateY(100%)",  // from the bottom
  "translateX(-100%)", // from the left
];

export default function HeroSlideshow({
  slides, className, interval = 5000,
}: {
  slides: HeroSlide[];
  className?: string;
  interval?: number;
}) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => setI((n) => (n + 1) % slides.length), interval);
    return () => clearInterval(t);
  }, [slides.length, interval]);

  if (!slides.length) return null;
  const current = slides[Math.min(i, slides.length - 1)];

  return (
    <div className={className}>
      {slides.map((s, idx) => {
        const active = idx === i;
        return (
          <img
            key={s.src}
            src={s.src}
            alt=""
            aria-hidden="true"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              transform: active ? "translate(0, 0)" : OFFSETS[idx % OFFSETS.length],
              opacity: active ? 1 : 0,
              zIndex: active ? 2 : 1,
              transition: "transform 1200ms cubic-bezier(0.22, 1, 0.36, 1), opacity 1200ms ease",
            }}
          />
        );
      })}

      {/* blend the left edge into the white page */}
      <div className="absolute inset-0 z-[3]" style={{ background: "linear-gradient(to right, #ffffff 0%, rgba(255,255,255,0) 36%)" }} />
      {/* on-brand tint for cohesion */}
      <div className="absolute inset-0 z-[3] mix-blend-multiply" style={{ background: "linear-gradient(115deg, rgba(13,148,136,0.20), rgba(249,115,22,0.08) 55%, transparent 80%)" }} />
      {/* soft top/bottom vignette */}
      <div className="absolute inset-0 z-[3]" style={{ background: "linear-gradient(to bottom, #ffffff 0%, transparent 16%, transparent 82%, rgba(255,255,255,0.85) 100%)" }} />

      {/* industry caption — updates with each slide */}
      <div className="absolute bottom-7 right-7 z-[4]">
        <span className="inline-flex items-center gap-2 rounded-full border border-surface-border bg-white/85 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-brand-700 shadow-sm backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-cyan" />
          {current.label}
        </span>
      </div>
    </div>
  );
}
