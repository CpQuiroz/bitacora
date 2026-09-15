import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@bitacora/shared", "@bitacora/ui"],
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
