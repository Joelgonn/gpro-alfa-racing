import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lobo Alfa",
    short_name: "Lobo Alfa",
    description: "Estratégia, setup e comunidade para gerentes da Equipe Alfa Racing Brasil no GPRO.",
    start_url: "/",
    id: "/",
    display: "standalone",
    background_color: "#030712",
    theme_color: "#030712",
    orientation: "portrait",
    categories: ["sports", "games", "utilities"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable", // ← CORRIGIDO: "maskable" (sem "icon-")
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable", // ← CORRIGIDO: "maskable" (sem "icon-")
      },
    ],
    screenshots: [
      {
        src: "/screenshots/desktop-home.png",
        sizes: "1920x1080",
        type: "image/png",
        form_factor: "wide",
        label: "Dashboard Principal - Desktop",
      },
      {
        src: "/screenshots/mobile-home.png",
        sizes: "1080x1920",
        type: "image/png",
        label: "Dashboard Principal - Mobile",
      },
    ],
  };
}