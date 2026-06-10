function getStorageApiUrl(): string {
  const url = process.env.STORAGE_API_URL?.trim();
  if (!url) throw new Error('STORAGE_API_URL is not set');
  return url;
}

function getStorageApiSecret(): string {
  const secret = process.env.STORAGE_API_SECRET?.trim();
  if (!secret) throw new Error('STORAGE_API_SECRET is not set');
  return secret;
}

export interface StorageFile {
  body: ReadableStream<Uint8Array>;
  contentType: string;
  contentLength: string | null;
}

export async function readStorageFile(relPath: string): Promise<StorageFile | null> {
  const url = new URL(getStorageApiUrl());
  url.searchParams.set('path', relPath);

  const res = await fetch(url, {
    headers: { 'X-Storage-Secret': getStorageApiSecret() },
    cache: 'no-store',
  });

  if (!res.ok || !res.body) return null;

  return {
    body: res.body,
    contentType: res.headers.get('content-type') || 'application/octet-stream',
    contentLength: res.headers.get('content-length'),
  };
}

export async function writeStorageFile(relPath: string, data: Buffer): Promise<void> {
  const url = new URL(getStorageApiUrl());
  url.searchParams.set('path', relPath);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Storage-Secret': getStorageApiSecret(),
      'Content-Type': 'application/octet-stream',
    },
    body: new Uint8Array(data),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Storage API write failed (${res.status}): ${text}`);
  }
}
