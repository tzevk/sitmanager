import type { Metadata } from 'next';
import { Archivo, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './corporate.css';

// Typefaces for this page only: Archivo (sturdy, slightly widened display),
// IBM Plex Sans for reading, IBM Plex Mono for labels and figures.
const display = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-ct-display', display: 'swap' });
const sans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-ct-sans', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-ct-mono', display: 'swap' });

const SITE = 'https://suvidya.app';
const PATH = '/public/corporate-training';
const TITLE = 'Corporate Engineering Training for Companies | Suvidya Institute of Technology (SIT)';
const DESCRIPTION =
  'Customised corporate training in piping, process, mechanical, structural, MEP, design & drafting, engineering software (E3D, PDMS, CAESAR II, SmartPlant P&ID) and operation & maintenance. 24+ years, 250+ corporate trainings, 21,000+ engineers trained. ECITB UK affiliated, ISO 9001:2015 certified. Mumbai & Pune, on site or online.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'corporate engineering training', 'corporate training India', 'piping engineering training for companies',
    'process engineering corporate training', 'E3D training', 'PDMS training', 'CAESAR II training',
    'SmartPlant P&ID training', 'MEP training', 'HVAC design training', 'design and drafting training',
    'operation and maintenance training', 'graduate engineer trainee training', 'GET training',
    'EPC company training', 'ECITB', 'Suvidya Institute of Technology', 'SIT Mumbai', 'SIT Pune',
  ],
  alternates: { canonical: PATH },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  openGraph: {
    type: 'website',
    url: PATH,
    siteName: 'Suvidya Institute of Technology',
    title: 'Corporate Engineering Training | Suvidya Institute of Technology',
    description: 'Training that is a rehearsal of actual working: customised engineering, drafting, software and O&M programmes for your teams. 24+ years, 250+ corporate trainings.',
    locale: 'en_IN',
    images: [{ url: '/corporate-training/ev2.jpg', width: 1280, height: 960, alt: 'SIT corporate training batch' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Corporate Engineering Training | SIT',
    description: 'Customised engineering, drafting, software and O&M training for companies. 24+ years, 250+ corporate trainings.',
    images: ['/corporate-training/ev2.jpg'],
  },
  other: { 'geo.region': 'IN-MH', 'geo.placename': 'Mumbai, Pune' },
};

// Structured data so search engines understand who SIT is and what this page offers.
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': ['EducationalOrganization', 'Organization'],
      '@id': `${SITE}${PATH}#org`,
      name: 'Suvidya Institute of Technology Pvt. Ltd.',
      alternateName: 'SIT',
      url: 'https://suvidya.ac.in',
      logo: `${SITE}/corporate-training/sit-logo.png`,
      email: 'enquiry@suvidya.ac.in',
      telephone: '+91-9167219401',
      sameAs: ['https://suvidya.ac.in'],
      hasCredential: [
        { '@type': 'EducationalOccupationalCredential', name: 'ISO 9001:2015 certified (Bureau of Indian Standards)' },
        { '@type': 'EducationalOccupationalCredential', name: 'ECITB, United Kingdom affiliated (Plant Layout Design)' },
      ],
      memberOf: [
        { '@type': 'Organization', name: 'Confederation of Indian Industry' },
        { '@type': 'Organization', name: 'Maharashtra Chamber of Commerce, Industry & Agriculture' },
      ],
      address: [
        { '@type': 'PostalAddress', streetAddress: '18/140, Anand Nagar, Nehru Road, Near Vakola Police Station, Vakola, Santacruz (East)', addressLocality: 'Mumbai', addressRegion: 'Maharashtra', postalCode: '400055', addressCountry: 'IN' },
        { '@type': 'PostalAddress', streetAddress: '303, Success Square, Karve Road, Paschimanagri, Kothrud', addressLocality: 'Pune', addressRegion: 'Maharashtra', postalCode: '411038', addressCountry: 'IN' },
      ],
    },
    {
      '@type': 'Service',
      '@id': `${SITE}${PATH}#service`,
      name: 'Corporate Engineering Training',
      serviceType: 'Corporate training',
      provider: { '@id': `${SITE}${PATH}#org` },
      areaServed: [{ '@type': 'Country', name: 'India' }, { '@type': 'Place', name: 'Worldwide (online)' }],
      description: DESCRIPTION,
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Corporate training programmes',
        itemListElement: [
          'Piping & Process Engineering', 'Mechanical, Structural & MEP', 'Design & Drafting',
          'Engineering Software (E3D, PDMS, CAESAR II, SmartPlant P&ID, AutoCAD)', 'Operation & Maintenance',
          'Specialised Programmes (Offshore, Fire Alarm & Protection, NDT)',
        ].map((name) => ({ '@type': 'Offer', itemOffered: { '@type': 'Course', name, provider: { '@id': `${SITE}${PATH}#org` } } })),
      },
    },
    {
      '@type': 'WebPage',
      '@id': `${SITE}${PATH}`,
      url: `${SITE}${PATH}`,
      name: TITLE,
      description: DESCRIPTION,
      inLanguage: 'en-IN',
      about: { '@id': `${SITE}${PATH}#service` },
      primaryImageOfPage: `${SITE}/corporate-training/ev2.jpg`,
    },
  ],
};

export default function CorporateTrainingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {children}
    </div>
  );
}
