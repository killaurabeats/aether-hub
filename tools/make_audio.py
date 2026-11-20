#!/usr/bin/env python3
"""Synthesises the Aether Hub startup sting and demo pack audio.

Everything here is generated from scratch (no samples, no external licences):
  * a 4.2 s cinematic logo sting: airy pad, warm sub, crystal bell, reverb
  * an original 808 drumkit for the demo release
  * preview one-shots + a short demo groove for the in-card player
"""
from __future__ import annotations

import math
import shutil
import wave
import zipfile
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
SOUND = PUBLIC / "sound"
PREVIEWS = PUBLIC / "previews"
RELEASES = ROOT / "src-tauri" / "resources" / "releases"
SR = 44100


def write_wav(
    path: Path,
    data: np.ndarray,
    sr: int = SR,
    stereo: bool = True,
    normalize: bool = True,
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if data.ndim == 1:
        data = np.stack([data, data], axis=1) if stereo else data[:, None]

    if normalize:
        peak = np.max(np.abs(data)) or 1.0
        data = data / peak * 0.89
    pcm = np.clip(data, -1, 1)
    pcm = (pcm * 32767.0).astype("<i2")

    with wave.open(str(path), "wb") as f:
        f.setnchannels(2 if stereo else 1)
        f.setsampwidth(2)
        f.setframerate(sr)
        f.writeframes(pcm.tobytes())


def smoothstep(x: np.ndarray) -> np.ndarray:
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3 - 2 * x)


def lowpass(x: np.ndarray, cutoff: float, sr: int = SR, passes: int = 2) -> np.ndarray:
    alpha = 1.0 - math.exp(-2.0 * math.pi * cutoff / sr)
    y = x.astype(np.float64, copy=True)
    for _ in range(passes):
        out = np.empty_like(y)
        prev = 0.0
        for i in range(len(y)):
            prev += alpha * (y[i] - prev)
            out[i] = prev
        y = out
    return y


def highpass(x: np.ndarray, cutoff: float, sr: int = SR, passes: int = 2) -> np.ndarray:
    return x - lowpass(x, cutoff, sr, passes)


def stereo_delay(x: np.ndarray, samples: int) -> np.ndarray:
    out = np.zeros_like(x)
    if samples <= 0:
        return x
    out[samples:] = x[:-samples]
    return out


def reverb_ir(duration: float = 2.1, sr: int = SR, seed: int = 9) -> np.ndarray:
    rng = np.random.default_rng(seed)
    n = int(duration * sr)
    t = np.arange(n) / sr
    decay = np.exp(-t / 0.62)
    irs = []
    for _ in range(2):
        noise = rng.normal(0, 1, n)
        # Roll off the tail: darker as it decays, like a real hall.
        bright = np.exp(-t / 0.35)
        dark = lowpass(noise, 2400.0, sr, 1)
        mixed = noise * bright + dark * (1.0 - bright)
        irs.append(mixed * decay)
    ir = np.stack(irs, axis=1)
    ir[: int(0.008 * sr)] *= np.linspace(0, 1, int(0.008 * sr))[:, None]
    return ir / (np.sqrt(np.sum(ir**2, axis=0, keepdims=True)) + 1e-9)


def convolve_stereo(x: np.ndarray, ir: np.ndarray) -> np.ndarray:
    n = len(x) + len(ir) - 1
    size = 1 << (n - 1).bit_length()
    out = np.zeros((n, 2))
    for ch in range(2):
        X = np.fft.rfft(x[:, ch], size)
        H = np.fft.rfft(ir[:, ch], size)
        out[:, ch] = np.fft.irfft(X * H, size)[:n]
    return out


def make_startup() -> None:
    """Soft, velvet Am9 pad — pure sines, 2.2 kHz low-pass, -15 dBFS peak."""
    duration = 4.6
    n = int(duration * SR)
    t = np.arange(n) / SR

    # Am9 voicing: A2, E3, C4, G4, B4. Low, warm, no bright partials.
    voices = [
        (110.00, 0.20),
        (164.81, 0.17),
        (261.63, 0.14),
        (392.00, 0.08),
        (493.88, 0.05),
    ]

    pad = np.zeros((n, 2))
    for freq, amp in voices:
        for detune, pan in [(-0.0007, -0.22), (0.0, 0.0), (0.0008, 0.24)]:
            phase = 2 * math.pi * freq * (1.0 + detune) * t
            # A single pure sine per voice — no harmonics, no FM.
            voice = np.sin(phase) * amp
            pad[:, 0] += voice * (1.0 - max(0.0, pan))
            pad[:, 1] += voice * (1.0 + min(0.0, pan))

    # Warm sub, barely audible, gives weight on laptop speakers.
    sub = np.sin(2 * math.pi * 55.0 * t) * 0.10

    # 180 ms smooth attack, long exponential tail.
    attack = smoothstep(t / 0.18)
    decay = np.exp(-np.maximum(0.0, t - 0.18) / 1.6)
    # Keep a gentle body for the first moment, then dissolve.
    envelope = attack * (0.35 + 0.65 * decay)
    pad *= envelope[:, None]
    sub *= envelope

    pad = np.stack([lowpass(pad[:, c], 2200.0, SR, 2) for c in range(2)], axis=1)
    sub = lowpass(sub, 2200.0, SR, 2)

    dry = pad.copy()
    dry[:, 0] += sub
    dry[:, 1] += sub

    # Soft, dark hall; low wet level so it never feels washy.
    wet = convolve_stereo(dry, reverb_ir(duration=2.2, seed=17))[:n]
    mix = dry * 0.82 + wet * 0.26

    # Gentle bus soften (no hard clipping / no distortion).
    mix = np.tanh(mix * 1.05) * 0.9

    # Smooth end fade so the tail never clicks.
    fade_out = 1.0 - smoothstep((t - 3.9) / 0.7)
    mix *= fade_out[:, None]

    # Strict -15 dBFS peak normalization.
    target = 10 ** (-15.0 / 20.0)
    peak = float(np.max(np.abs(mix))) or 1.0
    mix = mix / peak * target

    write_wav(SOUND / "startup.wav", mix, normalize=False)

    peak_int = int(round(target * 32767))
    rms = float(np.sqrt(np.mean((mix * 32767) ** 2)))
    (SOUND / "startup.txt").write_text(
        "Aether Hub startup sting — generated by tools/make_audio.py.\n"
        "Am9 pad, pure sines, 2.2 kHz low-pass, 180 ms attack, 1.6 s decay, dark convolution reverb.\n"
        f"Peak: -15.0 dBFS ({peak_int} / 32767) · RMS: {rms:.0f}\n"
    )
    print("startup", (SOUND / "startup.wav").stat().st_size, "peak", peak_int)


def adsr(n: int, attack: float, decay: float, sr: int = SR) -> np.ndarray:
    t = np.arange(n) / sr
    env = np.minimum(1.0, t / max(attack, 1e-4))
    env *= np.exp(-t / max(decay, 1e-4))
    return env


def make_kick() -> np.ndarray:
    n = int(0.6 * SR)
    t = np.arange(n) / SR
    freq = 48 + 120 * np.exp(-t / 0.028)
    phase = 2 * math.pi * np.cumsum(freq) / SR
    body = np.sin(phase) * np.exp(-t / 0.23)
    click = highpass(np.random.default_rng(1).normal(0, 1, n), 1800) * np.exp(-t / 0.006) * 0.5
    return np.tanh((body + click) * 2.4)


def make_808() -> np.ndarray:
    n = int(1.8 * SR)
    t = np.arange(n) / SR
    freq = 41 + 55 * np.exp(-t / 0.09)
    phase = 2 * math.pi * np.cumsum(freq) / SR
    tone = np.sin(phase) + 0.22 * np.sin(2 * phase)
    env = np.exp(-t / 0.9)
    return np.tanh(tone * env * 3.2)


def make_snare() -> np.ndarray:
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    noise = highpass(np.random.default_rng(2).normal(0, 1, n), 1300)
    tone = np.sin(2 * math.pi * 186 * t) * np.exp(-t / 0.055)
    return np.tanh((noise * np.exp(-t / 0.12) * 0.9 + tone * 0.7) * 1.8)


def make_clap() -> np.ndarray:
    rng = np.random.default_rng(3)
    n = int(0.4 * SR)
    base = highpass(rng.normal(0, 1, n), 900)
    out = np.zeros(n)
    for offset in [0.0, 0.011, 0.022, 0.034]:
        start = int(offset * SR)
        env = np.exp(-np.arange(n - start) / (0.055 * SR))
        out[start:] += base[: n - start] * env
    out *= np.exp(-np.arange(n) / (0.13 * SR))
    return np.tanh(out * 2.0)


def make_hat(open_hat: bool = False) -> np.ndarray:
    n = int((0.55 if open_hat else 0.12) * SR)
    t = np.arange(n) / SR
    noise = highpass(np.random.default_rng(5).normal(0, 1, n), 7500, passes=3)
    metallic = sum(np.sin(2 * math.pi * f * t) for f in [6100, 7300, 8700]) * 0.06
    return (noise * 0.75 + metallic) * np.exp(-t / (0.26 if open_hat else 0.045))


def make_perc() -> np.ndarray:
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    mod = np.sin(2 * math.pi * 880 * t)
    tone = np.sin(2 * math.pi * 1320 * t + 2.5 * np.exp(-t / 0.15) * mod)
    return tone * np.exp(-t / 0.3) * 0.8


def make_demo_loop() -> np.ndarray:
    bpm = 148
    beat = 60.0 / bpm
    bars = 4
    total = int(beat * 4 * bars * SR) + SR
    mix = np.zeros((total, 2))

    kick = make_kick()
    snare = make_snare()
    hat = make_hat()
    open_hat = make_hat(True)
    bass = make_808()
    clap = make_clap()

    def place(sample: np.ndarray, at: float, gain: float = 1.0, pan: float = 0.0) -> None:
        start = int(at * SR)
        if start >= total:
            return
        end = min(total, start + len(sample))
        chunk = sample[: end - start] * gain
        mix[start:end, 0] += chunk * (1 - max(0.0, pan))
        mix[start:end, 1] += chunk * (1 + min(0.0, pan))

    swing_hats = [0, 0.5, 1, 1.5, 2, 2.25, 2.5, 3, 3.5]
    for bar in range(bars):
        b0 = bar * beat * 4
        for pos in [0, 2.75]:
            place(kick, b0 + beat * pos, 1.0)
        for pos in [1, 3]:
            place(snare, b0 + beat * pos, 0.75)
            place(clap, b0 + beat * pos + 0.002, 0.35, 0.1)
        for pos in swing_hats:
            place(hat if pos % 1 != 0 else open_hat, b0 + beat * pos, 0.42, -0.18)
        if bar in (1, 3):
            place(bass, b0 + beat * 2.5, 0.5, 0.05)
            place(bass, b0 + beat * 3.5, 0.42, 0.05)

    # Simple sidechain-ish dip on the music bus is unnecessary here; add glue.
    mix = np.tanh(mix * 1.15)
    mix = mix[: int(beat * 4 * bars * SR)]
    return mix


def make_demo_packs() -> None:
    kit_root = Path("/tmp/aether-kit/Aether 808 Essentials")
    if kit_root.parent.exists():
        shutil.rmtree(kit_root.parent)
    (kit_root / "Drums").mkdir(parents=True)
    (kit_root / "Previews").mkdir(parents=True)

    samples = {
        "Kick - Aether Punch.wav": make_kick(),
        "808 - Aether Sub.wav": make_808(),
        "Snare - Aether Snap.wav": make_snare(),
        "Clap - Aether Stack.wav": make_clap(),
        "HiHat - Closed.wav": make_hat(),
        "HiHat - Open.wav": make_hat(True),
        "Perc - Aether Glass.wav": make_perc(),
    }

    for name, data in samples.items():
        write_wav(kit_root / "Drums" / name, data, stereo=False)

    loop = make_demo_loop()
    write_wav(kit_root / "Previews" / "Aether 808 Demo.wav", loop)
    write_wav(PREVIEWS / "aether-808-demo.wav", loop)
    write_wav(PREVIEWS / "kick.wav", make_kick(), stereo=False)
    write_wav(PREVIEWS / "808.wav", make_808(), stereo=False)
    write_wav(PREVIEWS / "hat.wav", make_hat(), stereo=False)

    (kit_root / "README.txt").write_text(
        "AETHER 808 ESSENTIALS — v1.1\n"
        "Original samples generated for Aether Hub.\n"
        "Drums: 24-bit-ready one-shots, tuned to A. Previews contain a 4-bar demo.\n"
        "Drop this folder into your sampler or FL Studio browser.\n"
    )

    zip_path = RELEASES / "aether-808-essentials.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for file in kit_root.rglob("*"):
            z.write(file, file.relative_to(kit_root.parent))
    print("drumkit zip", zip_path.stat().st_size)

    # Preset pack -------------------------------------------------------------
    preset_root = Path("/tmp/aether-presets/Aether Vocal Chain")
    if preset_root.parent.exists():
        shutil.rmtree(preset_root.parent)
    preset_root.mkdir(parents=True)

    presets = {
        "01 - Clean Vocal.aetherpreset": {
            "format": "aether.preset.v1",
            "plugin": "AetherVocalStrip",
            "gate": {"threshold": -48, "range": 14, "smooth": 55},
            "eq": {"hpf": 85, "sub": -2.0, "box": -2.5, "body": 1.0, "presence": 2.0, "sibilance": -1.5, "air": 2.5},
            "fet": {"input": 12, "output": -3, "attack": 4, "release": 3, "ratio": "4:1"},
            "la2a": {"peak": 28, "gain": 6, "mode": "Compress"},
            "saturator": {"mode": "Standard", "band": "Full", "drive": 2.0},
            "output": {"dryWet": 100},
        },
        "02 - Airy Lead.aetherpreset": {
            "format": "aether.preset.v1",
            "plugin": "AetherVocalStrip",
            "gate": {"threshold": -52, "range": 10, "smooth": 70},
            "eq": {"hpf": 95, "sub": -3.0, "box": -3.0, "body": 0.5, "presence": 3.5, "sibilance": -2.0, "air": 5.0},
            "fet": {"input": 8, "output": -2, "attack": 6, "release": 4, "ratio": "4:1"},
            "la2a": {"peak": 35, "gain": 4, "mode": "Compress"},
            "saturator": {"mode": "Soft", "band": "High", "drive": 1.2},
            "output": {"dryWet": 85},
        },
        "03 - Rap Forward.aetherpreset": {
            "format": "aether.preset.v1",
            "plugin": "AetherVocalStrip",
            "gate": {"threshold": -46, "range": 22, "smooth": 25},
            "eq": {"hpf": 110, "sub": -4.0, "box": -1.0, "body": 2.0, "presence": 4.0, "sibilance": -2.5, "air": 3.0},
            "fet": {"input": 20, "output": -5, "attack": 2, "release": 3, "ratio": "12:1"},
            "la2a": {"peak": 22, "gain": 7, "mode": "Limit"},
            "saturator": {"mode": "Hard", "band": "Low", "drive": 4.0},
            "output": {"dryWet": 100},
        },
    }

    import json

    for name, payload in presets.items():
        (preset_root / name).write_text(json.dumps(payload, indent=2))

    (preset_root / "README.txt").write_text(
        "AETHER VOCAL CHAIN — v1.1\n\n"
        "Preset pack for AetherVocal Strip. The .aetherpreset files are JSON and\n"
        "document the exact module values used in the demo mix. Install with\n"
        "Aether Hub; the pack lands in FL Studio's Presets folder.\n"
    )

    zip_path = RELEASES / "aether-vocal-chain-presets.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for file in preset_root.rglob("*"):
            z.write(file, file.relative_to(preset_root.parent))
    print("preset zip", zip_path.stat().st_size)


def main() -> None:
    import sys

    RELEASES.mkdir(parents=True, exist_ok=True)
    SOUND.mkdir(parents=True, exist_ok=True)

    if "--sound-only" in sys.argv:
        make_startup()
        return

    make_startup()
    make_demo_packs()


if __name__ == "__main__":
    main()
