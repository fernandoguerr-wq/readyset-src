"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions";
import ThemeToggle from "@/components/ThemeToggle";

type NavLink = { href: string; label: string };

const ICONS: Record<string, React.ReactNode> = {
  "/dashboard": (
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
  ),
  "/mercado": <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />,
  "/explorar": (
    <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z" />
  ),
  "/como-empezar": (
    <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7M8 11h5" />
  ),
  "/admin": (
    <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6zM9 12l2 2 4-4" />
  ),
};

function Icon({ href }: { href: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[href]}
    </svg>
  );
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export default function MobileNav({
  links,
  tabs,
  userLabel,
}: {
  links: NavLink[];
  tabs: NavLink[];
  userLabel: string;
}) {
  const pathname = usePathname() || "";
  const [open, setOpen] = useState(false);

  // Cierra el menú al navegar y bloquea el scroll de fondo mientras está abierto.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="menu-btn"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {open && (
        <div className="mobile-drawer-backdrop" onClick={() => setOpen(false)}>
          <nav className="mobile-drawer" onClick={(e) => e.stopPropagation()} aria-label="Menú">
            <div className="mobile-drawer-user">{userLabel}</div>
            {links.map((l) => (
              <a key={l.href} href={l.href}
                className={`mobile-drawer-link ${isActive(pathname, l.href) ? "active" : ""}`}>
                {l.label}
              </a>
            ))}
            <div className="mobile-drawer-footer">
              <div className="mobile-drawer-row">
                <span>Modo oscuro</span>
                <ThemeToggle />
              </div>
              <form action={signOut}>
                <button type="submit" className="secondary-btn" style={{ width: "100%" }}>
                  Salir
                </button>
              </form>
            </div>
          </nav>
        </div>
      )}

      <nav className="bottom-nav mobile-only" aria-label="Navegación principal">
        {tabs.map((t) => (
          <a key={t.href} href={t.href}
            className={`bottom-nav-item ${isActive(pathname, t.href) ? "active" : ""}`}>
            <Icon href={t.href} />
            <span>{t.label}</span>
          </a>
        ))}
      </nav>
    </>
  );
}
