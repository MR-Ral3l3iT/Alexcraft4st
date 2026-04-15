/** เล่นเสียงสั้น ๆ เมื่อมีเช็คอินใหม่ (Web Audio API — ไม่ต้องมีไฟล์เสียง) */
export function playCheckInChime(): void {
  if (typeof window === "undefined") return;
  try {
    const ctx = new AudioContext();
    const playTone = (freq: number, start: number, duration: number, volume: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(freq, start);
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(volume, start + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, start + duration);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(start);
      o.stop(start + duration + 0.02);
    };

    void ctx.resume().then(() => {
      const t = ctx.currentTime;
      playTone(784, t, 0.14, 0.11);
      playTone(1047, t + 0.11, 0.16, 0.09);
      playTone(1319, t + 0.24, 0.2, 0.07);
      window.setTimeout(() => void ctx.close(), 700);
    });
  } catch {
    /* ignore */
  }
}
