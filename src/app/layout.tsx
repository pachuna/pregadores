import type { Metadata, Viewport } from "next";
import InstallHomePrompt from "@/components/InstallHomePrompt";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import PushSubscriber from "@/components/PushSubscriber";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";
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
  themeColor: "#050d1a",
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
        <PushSubscriber />
      </body>
    </html>
  );
}
