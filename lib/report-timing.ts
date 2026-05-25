type TimingMetaValue = string | number | boolean | null | undefined;

function normalizeMetaValue(value: TimingMetaValue): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value).trim().replace(/\s+/g, '_').slice(0, 80);
}

export function logReportCacheTiming(
  route: string,
  startedAt: number,
  cacheStatus: 'HIT' | 'MISS',
  meta: Record<string, TimingMetaValue> = {}
): void {
  const durationMs = Date.now() - startedAt;
  const parts = [
    '[report-cache]',
    `route=${route}`,
    `cache=${cacheStatus}`,
    `durationMs=${durationMs}`,
  ];

  for (const [key, value] of Object.entries(meta)) {
    const normalized = normalizeMetaValue(value);
    if (normalized !== null) {
      parts.push(`${key}=${normalized}`);
    }
  }

  console.info(parts.join(' '));
}