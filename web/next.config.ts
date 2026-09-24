import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@bitacora/shared", "@bitacora/ui"],
  // Rutas pasó a ser una subsección de Viajes (tarea 130, 24-sep-2026).
  // Redirección temporal (307), no permanente: si algún día se mueve de
  // nuevo, el navegador no queda con la redirección vieja en caché.
  async redirects() {
    return [
      { source: "/dashboard/rutas", destination: "/dashboard/viajes/rutas", permanent: false },
      { source: "/dashboard/rutas/:path*", destination: "/dashboard/viajes/rutas/:path*", permanent: false },
    ];
  },
  images: {
    // Todas las fotos/logos vienen de Supabase Storage — el ref del
    // proyecto cambia entre dev/prod, así que se permite cualquiera.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
};

export default nextConfig;
