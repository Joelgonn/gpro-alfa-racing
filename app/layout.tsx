import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap", // Melhora a performance de carregamento da fonte
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// Metadados profissionais e completos
export const metadata: Metadata = {
  title: {
    template: "%s | Nome da Sua Marca",
    default: "Alfa Racing Brasil Tool",
  },
  description: "Ferramenta de Setup e Estratégia exclusiva para gerentes da Equipe Alfa Racing Brasil.",
  icons: {
    icon: "/favicon.ico", // Garanta que você tenha um favicon
  },
  // Open Graph ajuda o link a ficar bonito quando compartilhado no WhatsApp/LinkedIn
  openGraph: {
    title: "Alfa Racing Brasil Tool",
    description: "Ferramenta de Setup e Estratégia da Equipe Alfa Racing Brasil.",
    type: "website",
    locale: "pt_BR",
  },
};

// Configuração de viewport para mobile
export const viewport: Viewport = {
  themeColor: "#000000", // Cor da barra do navegador no mobile
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
          bg-background 
          text-foreground 
          selection:bg-black selection:text-white
        `}
      >
        {/* Aqui você pode adicionar um Header/Navbar global futuramente */}
        <main className="flex flex-col min-h-screen">
            {children}
        </main>
        {/* Aqui você pode adicionar um Footer global futuramente */}
      </body>
    </html>
  );
}