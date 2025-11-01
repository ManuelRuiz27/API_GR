const UNIT_TO_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 60 * 60 * 24,
};

export function resolveDurationToSeconds(raw: string | number | undefined, fallback: number): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }

  if (typeof raw === 'string') {
    const numeric = Number(raw);
    if (!Number.isNaN(numeric)) {
      return numeric;
    }

    const match = raw.trim().match(/^(\d+)([smhd])$/i);
    if (match) {
      const value = Number(match[1]);
      const unit = match[2].toLowerCase();
      const factor = UNIT_TO_SECONDS[unit];
      if (factor) {
        return value * factor;
      }
    }
  }

  return fallback;
}
