import { initials } from "../lib/format";

export function Avatar({
  name,
  src,
  size = 32,
  className = "",
}: {
  name: string;
  src?: string | null;
  size?: 24 | 28 | 32 | 36 | 44 | 96 | number;
  className?: string;
}) {
  const sizeClass =
    size === 24 || size === 28 || size === 32 || size === 36 || size === 44 || size === 96
      ? `s${size}`
      : "";

  return (
    <div
      className={`avatar ${sizeClass} ${className}`}
      style={
        sizeClass
          ? undefined
          : { width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.34)) }
      }
      title={name}
    >
      {src ? <img src={src} alt={name} draggable={false} /> : initials(name || "Aether")}
    </div>
  );
}
