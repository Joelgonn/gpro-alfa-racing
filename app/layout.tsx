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

// Configuração de Viewport para Mobile (Premium Feel)
export const viewport: Viewport = {
  // Define a cor da barra de status do navegador para combinar com o header (gray-950)
  themeColor: "#030712", 
  width: "device-width",
  initialScale: 1,
  // maximumScale: 1, // Opcional: Remova o comentário se quiser impedir que o usuário dê zoom (sensação de app nativo), mas reduz acessibilidade.
};

export const metadata: Metadata = {
  title: {
    template: "%s | Alfa Racing Brasil",
    default: "Alfa Racing Brasil - GPRO Tool",
  },
  description: "Estratégia, setup e comunidade para gerentes da Equipe Alfa Racing Brasil no GPRO.",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png", // Recomendado criar este arquivo em /public
  },
  openGraph: {
    title: "Alfa Racing Brasil",
    description: "Domine as pistas com a Alfa Racing Brasil.",
    type: "website",
    locale: "pt_BR",
    siteName: "Alfa Racing Brasil",
  },
  // Melhora a experiência ao salvar na tela inicial do iOS
  appleWebApp: {
    title: "Lair of Wolves",
    statusBarStyle: "black-translucent",
    capable: true,
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
          /* Fundo padrão escuro para evitar flash branco no mobile */
          bg-gray-950 
          text-gray-100
          /* Seleção de texto na cor da marca (Amarelo/Preto) */
          selection:bg-yellow-500 selection:text-gray-900
          /* Previne rolagem horizontal acidental no mobile */
          overflow-x-hidden
        `}
      >
        <main className="flex flex-col min-h-screen">
            {children}
        </main>
      </body>
    </html>
  );
}