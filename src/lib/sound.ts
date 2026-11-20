let audio: HTMLAudioElement | null = null;
let retryAttached = false;

function ensureAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio("/sound/intro.wav");
    audio.preload = "auto";
  }
  return audio;
}

export function playIntro(volume = 0.6): void {
  const element = ensureAudio();
  element.volume = Math.min(1, Math.max(0, volume * 0.85));
  element.currentTime = 0;

  element.play().catch(() => {
    if (retryAttached) return;
    retryAttached = true;
    const retry = () => {
      element.play().catch(() => undefined);
      window.removeEventListener("pointerdown", retry);
      retryAttached = false;
    };
    window.addEventListener("pointerdown", retry, { once: true });
  });
}

export function setIntroVolume(volume: number): void {
  if (audio) audio.volume = Math.min(1, Math.max(0, volume * 0.85));
}

export function stopIntro(fade = true): void {
  if (!audio) return;
  if (!fade) {
    audio.pause();
    return;
  }

  const element = audio;
  const start = element.volume;
  const startedAt = performance.now();

  const tick = () => {
    const progress = Math.min(1, (performance.now() - startedAt) / 420);
    element.volume = start * (1 - progress);
    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      element.pause();
    }
  };

  requestAnimationFrame(tick);
}
