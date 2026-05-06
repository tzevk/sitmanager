/** Throws on non-2xx, surfacing the error body's `error` if present. */
export async function apiFetch<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const d = await res.json().catch(() => ({} as { error?: string }));
    throw new Error(d.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const jsonHeaders = { 'Content-Type': 'application/json' };
