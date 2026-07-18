// Same algorithm used by the Fee Details print receipt (client-side), kept
// here so server-side receipt rendering (email, PDF) produces identical wording.
function numToWords(n: number): string {
  const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
  const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
  if (n === 0) return 'ZERO';
  const b100 = (x: number) => (x < 20 ? ones[x] : `${tens[Math.floor(x / 10)]}${x % 10 ? ` ${ones[x % 10]}` : ''}`);
  const b1000 = (x: number) => (x < 100 ? b100(x) : `${ones[Math.floor(x / 100)]} HUNDRED${x % 100 ? ` ${b100(x % 100)}` : ''}`);
  let r = '';
  let num = n;
  if (num >= 10000000) { r += `${b1000(Math.floor(num / 10000000))} CRORE `; num %= 10000000; }
  if (num >= 100000) { r += `${b1000(Math.floor(num / 100000))} LAKH `; num %= 100000; }
  if (num >= 1000) { r += `${b100(Math.floor(num / 1000))} THOUSAND `; num %= 1000; }
  if (num > 0) r += b1000(num);
  return r.trim();
}

export function amountToWords(a: number): string {
  const cents = Math.round(a * 100);
  const rs = Math.floor(cents / 100);
  const ps = cents % 100;
  return `${numToWords(rs)} RUPEES${ps > 0 ? ` AND ${numToWords(ps)} PAISE` : ''} ONLY`;
}

export function formatReceiptDate(d: string | null | undefined): string {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return String(d);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [y, m, dy] = s.split('-');
  const day = parseInt(dy, 10);
  const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
  return `${day}${suffix} ${months[parseInt(m, 10) - 1]}-${y}`;
}

export function toSentenceCase(s: string | null | undefined): string {
  const v = (s ?? '').trim();
  if (!v) return '';
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
}
