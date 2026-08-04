import sharp from 'sharp';

/**
 * Resize+recompress an image to a small JPEG thumbnail. Used wherever an
 * image needs to travel over the network at a size much smaller than its
 * original upload (e.g. embedded in a generated document, or returned in a
 * bulk API response) — Vercel Serverless Functions cap both request and
 * response bodies at 4.5MB, and full-resolution student photo uploads
 * (several hundred KB to a few MB each) blow through that in any batch of
 * more than a handful of students.
 *
 * Returns null on corrupt/unsupported input rather than throwing, so one bad
 * image never fails an entire batch operation.
 */
export async function resizeToThumbnail(
  bytes: Buffer,
  { width = 300, height = 360, quality = 82 }: { width?: number; height?: number; quality?: number } = {}
): Promise<Buffer | null> {
  try {
    return await sharp(bytes)
      .resize(width, height, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer();
  } catch {
    return null;
  }
}
