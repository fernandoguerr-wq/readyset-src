/** @type {import('next').NextConfig} */
const nextConfig = {
  // Secciones que se unificaron: las direcciones viejas siguen funcionando.
  async redirects() {
    return [
      { source: "/simulador", destination: "/explorar", permanent: false },
      { source: "/dashboard/resumen", destination: "/dashboard?ver=ganancias", permanent: false },
      { source: "/admin/importar-cartera", destination: "/admin?ver=importar", permanent: false },
    ];
  },
};

module.exports = nextConfig;
