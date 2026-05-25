import type { Metadata, Viewport } from "next";
import { Public_Sans, Geist_Mono, Libre_Franklin } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const metaAppId = process.env.NEXT_PUBLIC_META_APP_ID?.trim();
const metaApiVersion = process.env.NEXT_PUBLIC_META_API_VERSION?.trim() || "v23.0";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
  weight: ["300", "400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const libreFranklin = Libre_Franklin({
  variable: "--font-libre-franklin",
  subsets: ["latin"],
  weight: ["700"],
  display: "swap",
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2E3093',
};

export const metadata: Metadata = {
  title: "SIT Manager",
  description: "Suvidya Institute of Technology Management System",
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
  robots: "noindex, nofollow", // Private app - don't index
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        {/* DNS prefetch for external resources */}
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.gstatic.com" />
        <link rel="dns-prefetch" href="//cdnjs.cloudflare.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" />
      </head>
      <body
        className={`${publicSans.variable} ${geistMono.variable} ${libreFranklin.variable} antialiased h-full`}
        suppressHydrationWarning
      >
        {metaAppId ? (
          <>
            <Script
              id="facebook-sdk-init"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
                  window.fbAsyncInit = function() {
                    FB.init({
                      appId: '${metaAppId}',
                      cookie: true,
                      xfbml: true,
                      version: '${metaApiVersion}'
                    });

                    FB.AppEvents.logPageView();
                  };
                `,
              }}
            />
            <Script
              id="facebook-jssdk"
              src="https://connect.facebook.net/en_US/sdk.js"
              strategy="afterInteractive"
            />
          </>
        ) : null}
        {children}
      </body>
    </html>
  );
}
