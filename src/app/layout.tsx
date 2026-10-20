import type { Metadata } from "next";
import localFont from "next/font/local";
import { ScreenSizeGate } from "@/components/production/screen-size-gate";
import { PreferencesProvider } from "@/components/production/preferences";
import "./globals.css";
const sans = localFont({
  src: [
    {
      path: "./fonts/00HypertextNon-Commercial-Regular.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/00HypertextNon-Commercial-Italic.otf",
      weight: "400",
      style: "italic",
    },
    {
      path: "./fonts/00HypertextNon-Commercial-Medium.otf",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/00HypertextNon-Commercial-MediumItalic.otf",
      weight: "500",
      style: "italic",
    },
  ],
  variable: "--font-hypertext",
  display: "swap",
  fallback: ["Arial", "sans-serif"],
});
const mono = localFont({
  src: [
    {
      path: "./fonts/00HypertextMonoNon-Commercial-Regular.otf",
      weight: "400",
    },
    { path: "./fonts/00HypertextMonoNon-Commercial-Medium.otf", weight: "500" },
  ],
  variable: "--font-hypertext-mono",
  display: "swap",
  fallback: ["Courier New", "monospace"],
});
const editorial = localFont({
  src: "./fonts/WagramNonCommercial-Regular.otf",
  variable: "--font-wagram",
  weight: "400",
  display: "swap",
  fallback: ["Georgia", "serif"],
});
const title = "Margin — A little room to think";
const description =
  "A research-paper reader that keeps your highlights, notes and questions beside the passage they belong to.";
const deploymentHost =
  process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
export const metadata: Metadata = {
  metadataBase: new URL(
    deploymentHost ? `https://${deploymentHost}` : "http://localhost:3000",
  ),
  applicationName: "Margin",
  title,
  description,
  openGraph: {
    title,
    description,
    siteName: "Margin",
    type: "website",
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title, description },
};

const themeScript = `try{var s=JSON.parse(localStorage.getItem('margin:settings:v1')||'{}');var t=s.theme||'auto';document.documentElement.dataset.theme=t==='auto'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;}catch(e){document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}`;
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable} ${editorial.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <PreferencesProvider>
          <ScreenSizeGate>{children}</ScreenSizeGate>
        </PreferencesProvider>
      </body>
    </html>
  );
}
