import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * cacheComponents est volontairement desactive. Le back-office affiche des
   * encaissements et des statuts de paiement en temps reel : une donnee servie
   * depuis un cache y serait pire qu'une seconde d'attente.
   */
  cacheComponents: false,

  images: {
    /*
     * Photos des candidats, servies par le stockage public de Laravel.
     *
     * L'hote est deduit de NEXT_PUBLIC_API_URL plutot qu'ecrit en dur : une
     * liste figee sur localhost laisse passer le build en production puis
     * casse toutes les fiches candidats a l'execution, next/image refusant
     * un hote non declare. Un seul reglage a renseigner, et les images
     * suivent l'API.
     */
    remotePatterns: [
      (() => {
        const api = new URL(
          process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1",
        );

        return {
          protocol: api.protocol.replace(":", "") as "http" | "https",
          hostname: api.hostname,
          ...(api.port ? { port: api.port } : {}),
        };
      })(),
      // Confort de developpement : les deux ecritures de la machine locale.
      { protocol: "http" as const, hostname: "127.0.0.1", port: "8000" },
      { protocol: "http" as const, hostname: "localhost", port: "8000" },
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
