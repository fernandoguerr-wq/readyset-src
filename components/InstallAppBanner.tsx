"use client";

import { useEffect, useState } from "react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "install-banner-dismissed";

// Registra el service worker (necesario para instalar la app) y, en el
// celular, ofrece instalarla en la pantalla de inicio.
export default function InstallAppBanner() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [mode, setMode] = useState<"hidden" | "android" | "ios">("hidden");

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    const isMobile = window.matchMedia("(max-width: 720px)").matches;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {}
    if (standalone || !isMobile || dismissed) return;

    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    if (isIOS) {
      setMode("ios");
      return;
    }

    // En Android mostramos el aviso siempre. Chrome recién habilita su botón
    // de instalación ("beforeinstallprompt") después de que la persona usa la
    // página un rato, así que mientras tanto damos las instrucciones del menú.
    setMode("android");
    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    }
    function onInstalled() {
      setMode("hidden");
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    setMode("hidden");
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice.catch(() => null);
    setDeferred(null);
    setMode("hidden");
  }

  if (mode === "hidden") return null;

  return (
    <div className="install-banner" role="region" aria-label="Instalar la app">
      <img src="/icons/icon-192.png" alt="" />
      <div>
        <strong>Instalá ReadySet en tu celular</strong>
        <div className="secondary">
          {mode === "ios" ? (
            <>
              Tocá el botón <strong>Compartir</strong> (el cuadrado con la flecha
              hacia arriba) y elegí <strong>&quot;Agregar a inicio&quot;</strong>.
            </>
          ) : deferred ? (
            "Se abre como una app, a pantalla completa y con su propio ícono."
          ) : (
            <>
              Tocá el menú <strong>⋮</strong> del navegador (arriba a la
              derecha) y elegí <strong>&quot;Instalar app&quot;</strong> o{" "}
              <strong>&quot;Agregar a la pantalla principal&quot;</strong>.
            </>
          )}
        </div>
        <div className="install-banner-actions">
          {mode === "android" && deferred && (
            <button type="button" onClick={install}>
              Instalar
            </button>
          )}
          <button type="button" className="secondary-btn" onClick={dismiss}>
            {mode === "ios" || !deferred ? "Entendido" : "Ahora no"}
          </button>
        </div>
      </div>
    </div>
  );
}
