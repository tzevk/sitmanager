'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { ADS_CONVERSION_ID, ADS_CONVERSION_LABEL } from '../tracking-config';

const NAV  = '#1B2A6B';
const GOLD = '#F5C518';

export default function ThankYouPage() {
  useEffect(() => {
    const w = window as unknown as { gtag?: (...a: unknown[]) => void };
    if (typeof w.gtag === 'function') {
      w.gtag('event', 'conversion', {
        send_to: `${ADS_CONVERSION_ID}/${ADS_CONVERSION_LABEL}`,
      });
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-white font-sans antialiased">

      {/* Header */}
      <div className="mb-10">
        <Image src="/sit.png" alt="Suvidya Institute of Technology" width={200} height={112} className="h-12 w-auto" priority />
      </div>

      {/* Card */}
      <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-xl">
        {/* Checkmark */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: `${GOLD}22` }}>
          <svg className="h-8 w-8" fill="none" stroke={GOLD} strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-black" style={{ color: NAV }}>Thank You!</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">
          Your enquiry has been submitted successfully.<br />
          Our admissions team will contact you shortly.
        </p>

        <div className="mt-6 h-px bg-slate-100" />

        <div className="mt-6 space-y-3">
          <a
            href="tel:+919821569885"
            className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold uppercase tracking-wider transition-opacity hover:opacity-90"
            style={{ background: GOLD, color: NAV }}
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
            </svg>
            Call Us Now
          </a>
          <a
            href="/apply"
            className="flex w-full items-center justify-center rounded-lg border border-slate-200 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Back to Apply Page
          </a>
        </div>
      </div>

      <p className="mt-8 text-[11px] text-slate-400">
        © {new Date().getFullYear()} Suvidya Institute of Technology. All rights reserved.
      </p>
    </div>
  );
}
