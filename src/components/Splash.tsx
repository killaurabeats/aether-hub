import { useEffect } from "react";
import { motion } from "framer-motion";
import { useStore } from "../lib/store";
import { playIntro, stopIntro } from "../lib/sound";

export function Splash({ onSkip }: { onSkip: () => void }) {
  const { settings, ready, t } = useStore();

  useEffect(() => {
    // Wait for localStorage settings so an OFF toggle really starts silent.
    if (!ready) return;
    if (settings.soundEnabled) {
      playIntro(settings.soundVolume);
    }
    // The sting is intentionally allowed to finish after the splash fades:
    // its 1.6 s decay is part of the cinematic transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    const skip = (event?: KeyboardEvent) => {
      if (event) {
        if (![" ", "Enter", "Escape"].includes(event.key)) return;
        event.preventDefault();
      }
      stopIntro(false);
      onSkip();
    };

    const onKey = (event: KeyboardEvent) => skip(event);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip]);

  const skip = () => {
    stopIntro(false);
    onSkip();
  };

  return (
    <motion.div
      className="splash"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } }}
      onClick={skip}
      role="presentation"
      title={t("Нажмите, чтобы пропустить")}
    >
      <div className="splash-inner">
        <motion.div
          className="splash-logo-wrap"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="splash-halo" />
          <motion.img
            className="splash-logo"
            src="/logo.png"
            alt="Aether Plugins"
            initial={{ filter: "blur(14px)", scale: 0.94 }}
            animate={{ filter: "blur(0px)", scale: 1 }}
            transition={{ duration: 1.25, ease: [0.16, 1, 0.3, 1] }}
            draggable={false}
          />
        </motion.div>

        <div className="splash-copy">
          <motion.h1
            initial={{ opacity: 0, y: 14, letterSpacing: "0.14em" }}
            animate={{ opacity: 1, y: 0, letterSpacing: "0.015em" }}
            transition={{ delay: 0.48, duration: 1.05, ease: [0.16, 1, 0.3, 1] }}
          >
            Aether Hub
          </motion.h1>

          <motion.div
            className="splash-rule"
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ delay: 0.86, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          />

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.98, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            Aether Plugins · by. @killaurabeats
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.18, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            style={{
              marginTop: 13,
              fontSize: 12,
              letterSpacing: "0.08em",
              color: "rgba(226, 216, 255, 0.78)",
            }}
          >
            {t("Ничего лишнего. Только звук.")}
          </motion.div>
        </div>

        <motion.div
          className="splash-progress"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.4 }}
        >
          <motion.span
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 2.6, ease: [0.4, 0, 0.2, 1] }}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
