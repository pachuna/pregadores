import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pregadores — Revisitas",
  description: "Gerenciamento de revisitas com mapa interativo",
  manifest: "/manifest.json",
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
      <body className="min-h-screen bg-[var(--color-surface)]">{children}</body>
    </html>
  );
}
