"use client";

import { useState } from "react";

// Pestañas internas de una página. El contenido de cada una llega ya armado
// desde el servidor; acá solo se elige cuál mostrar y se refleja en la URL
// (?ver=...) para poder compartir o volver directo a esa pestaña.
export default function PageTabs({
  tabs,
  initial,
}: {
  tabs: { id: string; label: string; content: React.ReactNode }[];
  initial?: string;
}) {
  const [active, setActive] = useState(
    tabs.some((t) => t.id === initial) ? initial! : tabs[0].id
  );

  function select(id: string) {
    setActive(id);
    try {
      const url = new URL(window.location.href);
      // Los parámetros de una pestaña (búsqueda, símbolo preelegido) no pasan a otra.
      url.searchParams.delete("q");
      url.searchParams.delete("simbolo");
      if (id === tabs[0].id) url.searchParams.delete("ver");
      else url.searchParams.set("ver", id);
      window.history.replaceState(null, "", url.toString());
    } catch {}
  }

  return (
    <>
      <div className="tabs page-tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={active === t.id}
            className={active === t.id ? "active" : ""} onClick={() => select(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" hidden={active !== t.id}>
          {t.content}
        </div>
      ))}
    </>
  );
}
