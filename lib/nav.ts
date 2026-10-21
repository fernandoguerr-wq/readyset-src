export type NavLink = { href: string; label: string; short: string; nav: string };

// Todas las secciones de la app. `label` es el nombre completo (menú y título
// de la barra superior); `short` es el nombre corto de la barra inferior del
// celular.
export const SECTIONS: NavLink[] = [
  { href: "/dashboard", label: "Mi cartera", short: "Cartera", nav: "Mi cartera" },
  { href: "/mercado", label: "Mercado", short: "Mercado", nav: "Mercado" },
  { href: "/explorar", label: "Explorar", short: "Explorar", nav: "Explorar" },
  { href: "/como-empezar", label: "Cómo empezar", short: "Empezar", nav: "Cómo empezar" },
  { href: "/admin", label: "Panel admin", short: "Admin", nav: "Admin" },
  { href: "/terminos", label: "Términos y avisos legales", short: "Términos", nav: "Términos" },
];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function currentSection(pathname: string): NavLink | null {
  return SECTIONS.find((s) => isActive(pathname, s.href)) || null;
}
