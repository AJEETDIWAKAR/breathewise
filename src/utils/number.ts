export function parseBoundedInt(
  raw: string,
  min: number,
  max: number,
  fallback: number,
): number {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

export function isSafeHttpUrl(url?: string | null): url is string {
  if (!url) return false;
  return /^https?:\/\//i.test(url.trim());
}
