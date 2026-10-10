/**
 * Configuration lisible par le navigateur.
 *
 * Volontairement separee de api.ts, qui importe next/headers et ne peut donc
 * vivre que cote serveur. Les composants client (formulaire d'inscription,
 * suivi de paiement) ne tirent ainsi aucun code serveur dans leur bundle.
 */
export const BASE_PUBLIQUE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
