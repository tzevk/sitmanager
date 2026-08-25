// ─────────────────────────────────────────────────────────────────────────
// Google Ads / GA4 conversion tracking — PLACEHOLDER IDs.
// Replace GA4_MEASUREMENT_ID and ADS_CONVERSION_ID/ADS_CONVERSION_LABEL below
// with your real values from Google Ads (Tools > Conversions) and Google
// Analytics (Admin > Data Streams) once you have them. No other code needs
// to change — layout.tsx loads gtag.js with these IDs, and page.tsx fires
// the conversion event on successful submit using the same values.
// ─────────────────────────────────────────────────────────────────────────
export const GA4_MEASUREMENT_ID = 'G-XXXXXXXXXX';
export const ADS_CONVERSION_ID = 'AW-XXXXXXXXX';
export const ADS_CONVERSION_LABEL = 'XXXXXXXXXX';

export const TRACKING_CONFIGURED =
  !GA4_MEASUREMENT_ID.includes('XXXXXXXXXX') || !ADS_CONVERSION_ID.includes('XXXXXXXXX');
