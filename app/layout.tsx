import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#030712",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    template: "%s | Lobo Alfa",
    default: "Lobo Alfa - GPRO Tool",
  },
  description:
    "Estratégia, setup e comunidade para gerentes da Equipe Alfa Racing Brasil no GPRO.",
  // REMOVA a linha manifest: "/manifest.json" - o App Router já cuida disso via app/manifest.ts
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Lobo Alfa",
    description: "Domine as pistas com a Alfa Racing Brasil.",
    type: "website",
    locale: "pt_BR",
    siteName: "Lobo Alfa",
  },
  appleWebApp: {
    title: "Lobo Alfa",
    statusBarStyle: "black-translucent",
    capable: true,
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="scroll-smooth">
      <body
        className={`
          ${geistSans.variable} 
          ${geistMono.variable} 
          antialiased 
          min-h-screen 
          bg-gray-950 
          text-gray-100
          selection:bg-yellow-500 selection:text-gray-900
          overflow-x-hidden
        `}
      >
        <main className="flex flex-col min-h-screen">{children}</main>
      </body>
    </html>
  );
}