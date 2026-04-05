"use client";

import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const HIDE_KEY = "pregadores-a2hs-hide-v1";

function isIOS() {
  if (typeof window === "undefined") {
    return false;
  }

  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua);
}

function isIOSSafari() {
  if (typeof window === "undefined") {
    return false;
  }

  const ua = window.navigator.userAgent.toLowerCase();
  // iOS Safari: contém "iphone/ipad" mas NÃO contém "crios" (Chrome iOS) nem "fxios" (Firefox iOS)
  return /iphone|ipad|ipod/.test(ua) && !/(crios|fxios|opios|mercury)/.test(ua);
}

function isStandaloneMode() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function InstallHomePrompt() {
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const iOSSafariDevice = useMemo(() => isIOSSafari(), []);

  const supportsInstall = useMemo(() => deferredPrompt != null, [deferredPrompt]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (localStorage.getItem(HIDE_KEY) === "1") {
      return;
    }

    if (isStandaloneMode()) {
      localStorage.setItem(HIDE_KEY, "1");
      return;
    }

    // iOS: só mostra no Safari — outros browsers não suportam instalação
    if (isIOS() && !isIOSSafari()) {
      return;
    }

    const timer = window.setTimeout(() => {
      // iOS Safari não dispara beforeinstallprompt — mostra prompt manual
      if (isIOSSafari() && !isStandaloneMode()) {
        setVisible(true);
      }
    }, 2200);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const onAppInstalled = () => {
      localStorage.setItem(HIDE_KEY, "1");
      setVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      setVisible(false);
      return;
    }

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === "accepted") {
      localStorage.setItem(HIDE_KEY, "1");
    }

    setDeferredPrompt(null);
    setVisible(false);
  };

  const handleLater = () => {
    setVisible(false);
  };

  const handleNeverShow = () => {
    localStorage.setItem(HIDE_KEY, "1");
    setVisible(false);
  };

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed left-3 right-3 z-50" style={{ bottom: "calc(5.8rem + env(safe-area-inset-bottom))" }}>
      <section className="rounded-2xl border border-[var(--color-border)] bg-white/95 backdrop-blur-sm shadow-[var(--shadow-strong)] p-4">
        <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[var(--color-text-light)]">
          Atalho do app
        </p>
        <h3 className="text-lg font-bold text-[var(--color-primary-dark)] mt-1">
          Adicionar na tela inicial?
        </h3>
        <p className="text-sm text-[var(--color-text)] mt-2">
          Fica mais rápido de abrir e usar no dia a dia.
        </p>

        {!supportsInstall && (
          <p className="text-xs text-[var(--color-text-light)] mt-2">
            {iOSSafariDevice
              ? "No iPhone: toque em Compartilhar (□↑) e depois em \"Adicionar à Tela de Início\"."
              : "No navegador, use o menu e escolha Adicionar a tela inicial."}
          </p>
        )}

        {iOSSafariDevice && !supportsInstall && (
          <ol className="mt-2 space-y-1 text-xs text-[var(--color-text-light)] list-decimal pl-4">
            <li>Toque no ícone Compartilhar <strong>□↑</strong> na barra do Safari.</li>
            <li>Role para baixo e toque em <strong>Adicionar à Tela de Início</strong>.</li>
            <li>Confirme tocando em <strong>Adicionar</strong> no canto superior.</li>
          </ol>
        )}

        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={handleInstall}
          >
            {supportsInstall ? "Adicionar agora" : "Entendi"}
          </button>
          <button
            type="button"
            className="w-full rounded-[10px] border border-[var(--color-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-text)]"
            onClick={handleLater}
          >
            Agora não
          </button>
          <button
            type="button"
            className="w-full rounded-[10px] border border-[var(--color-primary)] bg-[var(--color-primary-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-primary-dark)]"
            onClick={handleNeverShow}
          >
            Não mostrar novamente
          </button>
        </div>
      </section>
    </div>
  );
}
