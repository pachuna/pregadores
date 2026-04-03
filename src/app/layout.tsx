import type { Metadata, Viewport } from "next";
import InstallHomePrompt from "@/components/InstallHomePrompt";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import "@fontsource/merriweather/400.css";
import "@fontsource/merriweather/700.css";
import "@fontsource/merriweather/900.css";
import "@fontsource/source-sans-3/400.css";
import "@fontsource/source-sans-3/500.css";
import "@fontsource/source-sans-3/600.css";
import "@fontsource/source-sans-3/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pregadores — Revisitas",
  description: "Gerenciamento de revisitas com mapa interativo",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pregadores",
  },
  icons: {
    apple: "/apple-touch-icon.png",
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#4a6da7",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-[var(--color-surface)] text-[var(--color-text)]">
        {children}
        <InstallHomePrompt />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
