import { Star } from "lucide-react";
import clsx from "clsx";

export function RatingStars({ value, size = 16, showValue, count }:
  { value: number; size?: number; showValue?: boolean; count?: number }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex items-center">
        {[0, 1, 2, 3, 4].map((i) => {
          const filled = i < full;
          const isHalf = i === full && half;
          return (
            <span key={i} className="relative" style={{ width: size, height: size }}>
              <Star className="absolute inset-0 text-surface-border" style={{ width: size, height: size }} strokeWidth={1.5} />
              {(filled || isHalf) && (
                <span className="absolute inset-0 overflow-hidden" style={{ width: isHalf ? size / 2 : size }}>
                  <Star className="text-brand-500 fill-brand-500" style={{ width: size, height: size }} strokeWidth={1.5} />
                </span>
              )}
            </span>
          );
        })}
      </span>
      {showValue && (
        <span className={clsx("text-sm font-medium text-ink")}>
          {value ? value.toFixed(1) : "New"}
          {count != null && <span className="text-ink-faint font-normal"> ({count})</span>}
        </span>
      )}
    </span>
  );
}
