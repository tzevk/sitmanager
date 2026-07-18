import { existsSync } from 'fs';

/**
 * Renders arbitrary HTML to a PDF buffer using headless Chrome — used so the
 * emailed fee receipt is pixel-identical to the printed one (see
 * lib/receipt-html.ts), instead of a hand-approximated PDFKit drawing.
 *
 * On Vercel/Lambda (Linux), uses puppeteer-core + @sparticuz/chromium's
 * bundled binary. Locally, falls back to a system-installed Chrome/Chromium
 * (puppeteer-core has no browser of its own) — set CHROME_EXECUTABLE_PATH to
 * override the auto-detected path.
 */
async function resolveExecutablePath(): Promise<string> {
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (isServerless) {
    const chromium = (await import('@sparticuz/chromium')).default;
    return chromium.executablePath();
  }

  const candidates = [
    process.env.CHROME_EXECUTABLE_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ].filter((p): p is string => Boolean(p));

  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error(
      'No local Chrome/Chromium found for PDF rendering. Install Google Chrome, or set CHROME_EXECUTABLE_PATH.'
    );
  }
  return found;
}

export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const puppeteer = await import('puppeteer-core');
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const executablePath = await resolveExecutablePath();

  const launchArgs = isServerless
    ? (await import('@sparticuz/chromium')).default.args
    : ['--no-sandbox', '--disable-setuid-sandbox'];

  const browser = await puppeteer.launch({
    args: launchArgs,
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' },
      printBackground: true,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
