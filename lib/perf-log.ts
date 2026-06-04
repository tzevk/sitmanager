type PerfStatus = 'ok' | 'error';

interface PerfLogInput {
  endpoint: string;
  method: string;
  durationMs: number;
  status: PerfStatus;
  code?: number;
  meta?: Record<string, unknown>;
}

const DEFAULT_SLOW_REQUEST_THRESHOLD_MS = 1500;

function parseSlowRequestThresholdMs(rawValue: string | undefined): number {
  if (!rawValue) return DEFAULT_SLOW_REQUEST_THRESHOLD_MS;

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_SLOW_REQUEST_THRESHOLD_MS;

  // Keep threshold in a sane range to avoid accidental log storms or silence.
  return Math.max(100, Math.min(60_000, parsed));
}

let slowRequestThresholdMsCache: number | null = null;

export function getSlowRequestThresholdMs(): number {
  if (slowRequestThresholdMsCache != null) return slowRequestThresholdMsCache;

  slowRequestThresholdMsCache = parseSlowRequestThresholdMs(process.env.SLOW_REQUEST_THRESHOLD_MS);
  return slowRequestThresholdMsCache;
}

function toMetaText(meta?: Record<string, unknown>): string {
  if (!meta || Object.keys(meta).length === 0) return '';
  try {
    return ` meta=${JSON.stringify(meta)}`;
  } catch {
    return '';
  }
}

export function logEndpointTiming(input: PerfLogInput): void {
  const { endpoint, method, durationMs, status, code, meta } = input;
  const thresholdMs = getSlowRequestThresholdMs();
  const level = status === 'error' || durationMs >= thresholdMs ? 'warn' : 'info';
  const codeText = typeof code === 'number' ? ` code=${code}` : '';
  const metaText = toMetaText(meta);
  console[level](`[perf] ${method.toUpperCase()} ${endpoint} ${durationMs}ms status=${status}${codeText}${metaText}`);
}
