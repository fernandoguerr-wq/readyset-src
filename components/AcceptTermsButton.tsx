"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptTerms } from "@/app/actions";

export default function AcceptTermsButton({ version }: { version: string }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function accept() {
    setError(null);
    startTransition(async () => {
      try {
        await acceptTerms(version);
        router.replace("/");
        router.refresh();
      } catch (e: any) {
        setError(e.message || "No se pudo registrar la aceptación.");
      }
    });
  }

  return (
    <div className="accept-box">
      {error && <div className="error-box">{error}</div>}
      <label className="checkbox-line">
        <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
        <span>
          Leí y acepto estos términos. Entiendo que ReadySet Investment no es un
          bróker ni un asesor de inversión, que las tendencias de mercado no son
          recomendaciones y que soy responsable de la información que cargo.
        </span>
      </label>
      <button type="button" onClick={accept} disabled={!checked || pending}>
        {pending ? "Guardando…" : "Aceptar y continuar"}
      </button>
    </div>
  );
}
