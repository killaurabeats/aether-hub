import { useState } from "react";
import { Star } from "lucide-react";

export function Stars({
  value,
  onChange,
  size = 16,
  className = "",
}: {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  className?: string;
}) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <div
      className={`stars ${className}`}
      onMouseLeave={() => setHover(0)}
      role={onChange ? "radiogroup" : undefined}
      aria-label={`Рейтинг ${value} из 5`}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const on = shown >= star - 0.25;
        return onChange ? (
          <button
            key={star}
            type="button"
            className={on ? "on" : ""}
            onMouseEnter={() => setHover(star)}
            onClick={(event) => {
              event.stopPropagation();
              onChange(star);
            }}
            aria-label={`${star} звёзд`}
            role="radio"
            aria-checked={value === star}
          >
            <Star size={size} strokeWidth={1.5} />
          </button>
        ) : (
          <span key={star} className={on ? "on" : ""} style={{ color: on ? "var(--gold)" : undefined }}>
            <Star size={size} strokeWidth={1.5} style={{ fill: on ? "currentColor" : "none" }} />
          </span>
        );
      })}
    </div>
  );
}
