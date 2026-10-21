import type { Metadata, Viewport } from "next";
import "./globals.css";
import LegalFooter from "@/components/LegalFooter";
import { Analytics } from "@vercel/analytics/next";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_TAGLINE,
  applicationName: APP_NAME,
  appleWebApp: {
    capable: true,
    title: "ReadySet",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfb" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a19" },
  ],
};

// Corre antes del primer paint para evitar un flash del tema incorrecto:
// lee la preferencia guardada (o la del sistema) y la aplica al <html>
// antes de que el CSS se pinte.
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var theme =
      stored === "light" || stored === "dark"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}

  // Si el usuario cambia el tema en otra pestaña, esta se entera al instante.
  // El evento "storage" solo se dispara en las OTRAS pestañas del mismo origen,
  // así que no hace falta cuidarse de un bucle con la pestaña que lo cambió.
  try {
    window.addEventListener("storage", function (e) {
      if (e.key === "theme" && (e.newValue === "light" || e.newValue === "dark")) {
        document.documentElement.setAttribute("data-theme", e.newValue);
      }
    });
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
        <LegalFooter />
        {/* Medición de uso anónima (sin cookies). Se activa en Vercel → Analytics. */}
        <Analytics />
      </body>
    </html>
  );
}
