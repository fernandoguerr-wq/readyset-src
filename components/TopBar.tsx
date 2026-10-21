"use client";

import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions";
import ThemeToggle from "@/components/ThemeToggle";
import MobileNav from "@/components/MobileNav";
import { APP_NAME } from "@/lib/brand";
import { SECTIONS, currentSection, isActive } from "@/lib/nav";

// `title` se mantiene por compatibilidad con las páginas, pero el nombre de la
// sección ahora sale de la dirección en la que está el usuario.
export default function TopBar({
  userLabel,
  isAdmin,
}: {
  title?: string;
  userLabel: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname() || "";
  const section = currentSection(pathname);

  const visible = SECTIONS.filter((s) => isAdmin || !s.href.startsWith("/admin"));
  const desktopLinks = visible.filter((s) => s.href !== "/terminos");
  // "Cómo empezar" sigue en el menú y en la cartera vacía, no en la barra inferior.
  const tabs = visible.filter((s) => s.href !== "/terminos" && s.href !== "/como-empezar");

  return (
    <div className="topbar">
      <div className="topbar-title">
        <a href="/dashboard" className="topbar-brand">{APP_NAME}</a>
        {section && (
          <>
            <span className="topbar-sep" aria-hidden="true">›</span>
            <span className="topbar-section" aria-current="page">{section.label}</span>
          </>
        )}
      </div>
      <nav className="topbar-nav desktop-only" aria-label="Secciones">
        {desktopLinks.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className={`topbar-link ${isActive(pathname, l.href) ? "active" : ""}`}
            aria-current={isActive(pathname, l.href) ? "page" : undefined}
          >
            {l.nav}
          </a>
        ))}
        <span className="muted topbar-user" title={userLabel}>{userLabel.split(" ")[0]}</span>
        <ThemeToggle />
        <form action={signOut}>
          <button type="submit" className="secondary-btn">
            Salir
          </button>
        </form>
      </nav>
      <MobileNav
        links={visible.map(({ href, label }) => ({ href, label }))}
        tabs={tabs.map(({ href, short }) => ({ href, label: short }))}
        userLabel={userLabel}
      />
    </div>
  );
}
