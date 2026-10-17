const RESCAN_PHASES = [
  { until: 38, phase: 'Reading project files…', rate: 1.4 },
  { until: 68, phase: 'Analyzing source and quality rules…', rate: 0.85 },
] as const;

/** Simulated progress for file read + static analysis; CVE audit updates progress separately. */
export function startRescanProgressTicker(onTick: (progress: number, phase: string) => void): () => void {
  let progress = 6;
  let phaseIndex = 0;
  onTick(progress, RESCAN_PHASES[0].phase);

  const id = window.setInterval(() => {
    const phase = RESCAN_PHASES[phaseIndex];
    progress = Math.min(phase.until, progress + phase.rate);
    onTick(progress, phase.phase);
    if (progress >= phase.until && phaseIndex < RESCAN_PHASES.length - 1) {
      phaseIndex += 1;
    }
  }, 160);

  return () => window.clearInterval(id);
}
