import type { Metadata } from 'next';
import { Archivo, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './corporate.css';

// Typefaces for this page only: Archivo (sturdy, slightly widened display),
// IBM Plex Sans for reading, IBM Plex Mono for labels and figures.
const display = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-ct-display', display: 'swap' });
const sans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-ct-sans', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-ct-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'Corporate Training | Suvidya Institute of Technology',
  description:
    'Customised corporate training in engineering, drafting, software and operation & maintenance. 250+ corporate trainings, 21,000+ engineers trained, ECITB UK affiliated and ISO 9001:2015 certified.',
  robots: 'index, follow',
};

export default function CorporateTrainingLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${display.variable} ${sans.variable} ${mono.variable}`}>{children}</div>;
}
