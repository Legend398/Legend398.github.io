import type { Metadata, Viewport } from "next";
import { Azeret_Mono, Newsreader, Schibsted_Grotesk } from "next/font/google";
import Script from "next/script";
import { SiteHeader } from "@/components/SiteHeader";
import { profile } from "@/lib/portfolio";
import { siteUrl } from "@/lib/site";
import "./globals.css";

const googleAnalyticsId = "G-E16DF8VNBS";

const display = Newsreader({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const sans = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = Azeret_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: `Himanshu Kumar — ${profile.role}`,
    template: "%s — Himanshu Kumar",
  },
  description:
    "Software Engineer and Agentic AI Engineer building developer tools, software products, and data-science applications.",
  applicationName: "Himanshu Kumar — Portfolio",
  authors: [{ name: profile.name }],
  alternates: { canonical: "/" },
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }] },
  keywords: [
    "Himanshu Kumar",
    "software engineer",
    "agentic AI engineer",
    "data science",
    "Next.js",
    "TypeScript",
    "Python",
    "machine learning",
  ],
  openGraph: {
    title: `Himanshu Kumar — ${profile.role}`,
    description: "Software engineering, agentic AI engineering, and data science projects.",
    type: "website",
    url: "/",
    siteName: "Himanshu Kumar — Portfolio",
  },
  twitter: {
    card: "summary_large_image",
    title: `Himanshu Kumar — ${profile.role}`,
    description: "Software engineering, agentic AI engineering, and data science projects.",
  },
};

export const viewport: Viewport = {
  colorScheme: "dark light",
  themeColor: "#b9d9ec",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${googleAnalyticsId}');
          `}
        </Script>
        <a className="skipLink" href="#main-content">
          Skip to main content
        </a>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
