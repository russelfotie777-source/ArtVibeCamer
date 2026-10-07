import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * cacheComponents est volontairement desactive. Le back-office affiche des
   * encaissements et des statuts de paiement en temps reel : une donnee servie
   * depuis un cache y serait pire qu'une seconde d'attente.
   */
  cacheComponents: false,

  images: {
    remotePatterns: [
      // Photos des candidats servies par le stockage public de Laravel.
      { protocol: "http", hostname: "localhost", port: "8000" },
      { protocol: "http", hostname: "127.0.0.1", port: "8000" },
    ],
  },

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
