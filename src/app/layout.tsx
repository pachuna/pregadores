import type { Metadata, Viewport } from "next";
import { Merriweather, Source_Sans_3 } from "next/font/google";
import InstallHomePrompt from "@/components/InstallHomePrompt";
import "./globals.css";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const merriweather = Merriweather({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["400", "700", "900"],
});

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
      <body
        className={`${sourceSans.variable} ${merriweather.variable} min-h-screen bg-[var(--color-surface)] text-[var(--color-text)]`}
      >
        {children}
        <InstallHomePrompt />
      </body>
    </html>
  );
}
