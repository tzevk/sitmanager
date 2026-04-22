export function toBatchNumber(value: unknown): string {
  if (value === null || value === undefined) return '-';

  const text = String(value).trim();
  if (!text) return '-';

  const numericOnly = text.replace(/\D+/g, '');
  return numericOnly || '-';
}
