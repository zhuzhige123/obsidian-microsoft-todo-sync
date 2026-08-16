export function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

export function parseBoundedInt(
  raw: string,
  min: number,
  max: number,
  fallback: number
): number {
  return clampInt(Number.parseInt(raw, 10), min, max, fallback);
}

/** Shared numeric bounds for settings UI and normalizeSettings. */
export const SETTINGS_BOUNDS = {
  deltaIntervalMinutes: { min: 1, max: 60, default: 5 },
  autoSyncIdleSeconds: { min: 3, max: 120, default: 8 },
  autoSyncTagDelaySeconds: { min: 2, max: 30, default: 4 },
} as const;
