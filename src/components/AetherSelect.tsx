import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";

export interface AetherSelectOption {
  value: string;
  label: string;
}

export function AetherSelect({
  value,
  options,
  onChange,
  icon,
  ariaLabel,
  className = "",
  footer,
  menuWidth,
}: {
  value: string;
  options: AetherSelectOption[];
  onChange: (value: string) => void;
  icon?: ReactNode;
  ariaLabel: string;
  className?: string;
  footer?: ReactNode;
  menuWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`aether-select ${className}`} ref={rootRef}>
      <button
        type="button"
        className={`aether-select-trigger ${open ? "open" : ""}`}
        onClick={() => setOpen((current) => !current)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {icon ? <span className="aether-select-icon">{icon}</span> : null}
        <span className="aether-select-value">{selected?.label ?? ""}</span>
        <ChevronDown size={12} className="aether-select-chevron" />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="aether-select-menu"
            style={menuWidth ? { width: menuWidth } : undefined}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.985 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            role="listbox"
          >
            <div className="aether-select-scroll">
              {options.map((option) => {
                const active = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`aether-select-option ${active ? "active" : ""}`}
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    role="option"
                    aria-selected={active}
                  >
                    <span>{option.label}</span>
                    {active ? <Check size={12} /> : null}
                  </button>
                );
              })}
            </div>
            {footer ? (
              <div
                className="aether-select-footer"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                {footer}
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
