import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/*
 * Adaptation du build Next.js au runtime de Cloudflare Workers.
 *
 * Le front est en rendu serveur : dix routes sur douze sont produites a la
 * demande. Il lui faut donc un runtime, et non un hebergement de fichiers —
 * c'est ce que cet adaptateur fournit sur Workers.
 */
export default defineCloudflareConfig();
