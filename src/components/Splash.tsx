import { useEffect } from "react";
import { motion } from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";
import { useStore } from "../lib/store";
import { playIntro, setIntroVolume, stopIntro } from "../lib/sound";

export function Splash() {
  const { settings, updateSettings, t } = useStore();

  useEffect(() => {
    if (settings.soundEnabled) {
      playIntro(settings.soundVolume);
    }
    // The sting is intentionally allowed to finish after the splash fades:
    // its 1.6 s decay is part of the cinematic transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSound = () => {
    const next = !settings.soundEnabled;
    updateSettings({ soundEnabled: next });
    if (next) {
      playIntro(settings.soundVolume);
    } else {
      setIntroVolume(0);
      stopIntro(false);
    }
  };

  return (
    <motion.div
      className="splash"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } }}
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
            Aether Plugins
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
            by. @killaurabeats
          </motion.p>
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
            transition={{ duration: 1.85, ease: [0.4, 0, 0.2, 1] }}
          />
        </motion.div>
      </div>

      <button
        onClick={toggleSound}
        className="icon-button"
        style={{ position: "absolute", right: 22, bottom: 22, zIndex: 3 }}
        title={settings.soundEnabled ? t("Выключить звук заставки") : t("Включить звук заставки")}
        aria-label={t("Звук заставки")}
      >
        {settings.soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
      </button>

      <div className="splash-foot">Aether Hub · 1.1 · cinematic intro</div>
    </motion.div>
  );
}
