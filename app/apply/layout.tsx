import type { Metadata } from 'next';
import Script from 'next/script';
import { GA4_MEASUREMENT_ID, ADS_CONVERSION_ID } from './tracking-config';

export const metadata: Metadata = {
  title: 'Apply Now — Suvidya Institute of Technology',
  description:
    'Enrol in industry-focused Engineering Design, Piping, HVAC, Structural and Software training programmes at Suvidya Institute of Technology (SIT), Mumbai. Placement assistance included.',
  robots: 'index, follow',
};

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script
        id="gtag-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA4_MEASUREMENT_ID}');
            gtag('config', '${ADS_CONVERSION_ID}');
          `,
        }}
      />
      {children}
    </>
  );
}
