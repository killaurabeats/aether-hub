import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, Move, X, ZoomIn } from "lucide-react";
import { useStore } from "../lib/store";

const VIEW = 260;
const OUTPUT = 256;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function AvatarCropper({
  src,
  onCancel,
  onApply,
}: {
  src: string;
  onCancel: () => void;
  onApply: (dataUrl: string) => void;
}) {
  const { t } = useStore();
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const element = new Image();
    element.decoding = "async";
    element.onload = () => {
      setImage(element);
      setFailed(false);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    element.onerror = () => setFailed(true);
    element.src = src;

    return () => {
      element.onload = null;
      element.onerror = null;
    };
  }, [src]);

  const geometry = useMemo(() => {
    if (!image) {
      return { scale: 1, width: VIEW, height: VIEW, maxX: 0, maxY: 0 };
    }

    const baseScale = Math.max(VIEW / image.naturalWidth, VIEW / image.naturalHeight);
    const scale = baseScale * zoom;
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;

    return {
      scale,
      width,
      height,
      maxX: Math.max(0, (width - VIEW) / 2),
      maxY: Math.max(0, (height - VIEW) / 2),
    };
  }, [image, zoom]);

  useEffect(() => {
    setOffset((current) => {
      const x = clamp(current.x, -geometry.maxX, geometry.maxX);
      const y = clamp(current.y, -geometry.maxY, geometry.maxY);
      return x === current.x && y === current.y ? current : { x, y };
    });
  }, [geometry.maxX, geometry.maxY]);

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!image) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY };
    setDragging(true);
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;
    drag.current = { x: event.clientX, y: event.clientY };
    setOffset((current) => ({
      x: clamp(current.x + dx, -geometry.maxX, geometry.maxX),
      y: clamp(current.y + dy, -geometry.maxY, geometry.maxY),
    }));
  };

  const stopDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drag.current = null;
    setDragging(false);
  };

  const apply = () => {
    if (!image) return;

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;

    const context = canvas.getContext("2d");
    if (!context) return;

    const cropSize = VIEW / geometry.scale;
    const sourceX =
      (geometry.width / 2 - VIEW / 2 - offset.x) / geometry.scale;
    const sourceY =
      (geometry.height / 2 - VIEW / 2 - offset.y) / geometry.scale;

    context.fillStyle = "#120e22";
    context.fillRect(0, 0, OUTPUT, OUTPUT);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      sourceX,
      sourceY,
      cropSize,
      cropSize,
      0,
      0,
      OUTPUT,
      OUTPUT,
    );

    onApply(canvas.toDataURL("image/jpeg", 0.9));
  };

  return (
    <motion.div
      className="cropper-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <motion.div
        className="cropper-card"
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="cropper-head">
          <div>
            <h3>{t("Редактор аватарки")}</h3>
            <span className="sub">{t("1:1 · 256 × 256 px")}</span>
          </div>
          <button className="modal-close" onClick={onCancel} aria-label={t("Закрыть")}>
            <X size={14} />
          </button>
        </div>

        <div
          className={`cropper-viewport ${dragging ? "dragging" : ""}`}
          style={{ width: VIEW, height: VIEW }}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
          role="img"
          aria-label={t("Перетащите фото и настройте масштаб")}
        >
          {image ? (
            <img
              src={src}
              alt=""
              draggable={false}
              style={{
                width: geometry.width,
                height: geometry.height,
                left: `calc(50% + ${offset.x}px)`,
                top: `calc(50% + ${offset.y}px)`,
              }}
            />
          ) : (
            <div className="cropper-loading" />
          )}
          <span className="cropper-ring" />
          <span className="cropper-cross" />
          {failed ? <span className="cropper-error">{t("Не удалось загрузить изображение")}</span> : null}
        </div>

        <div className="cropper-hint">
          <Move size={12} /> {t("Перетащите фото и настройте масштаб")}
        </div>

        <div className="cropper-zoom">
          <ZoomIn size={14} />
          <input
            className="slider"
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            aria-label={t("Масштаб")}
          />
          <span className="mono">{zoom.toFixed(2)}x</span>
        </div>

        <div className="cropper-actions">
          <button className="btn btn-ghost" onClick={onCancel}>
            {t("Отмена")}
          </button>
          <button className="btn btn-primary" onClick={apply} disabled={!image}>
            <Check size={14} /> {t("Применить")}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
