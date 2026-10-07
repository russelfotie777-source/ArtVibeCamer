import "server-only";

import { cookies, headers } from "next/headers";
import { BASE_PUBLIQUE } from "./config";

/**
 * Acces a l'API Laravel.
 *
 * Point d'entree unique : aucun fetch disperse dans les composants, sinon la
 * gestion des erreurs et du jeton se duplique a chaque appel.
 *
 * Le jeton du back-office vit dans un cookie httpOnly, donc illisible par le
 * JavaScript de la page. Les ecrans d'administration sont des composants
 * serveur et les mutations passent par des Server Actions : le jeton ne
 * traverse jamais le navigateur.
 */

/*
 * API_URL permet de viser l'API par son adresse interne depuis le serveur
 * (reseau Docker, machine locale) quand l'URL publique passe par un domaine.
 */
const BASE = process.env.API_URL ?? BASE_PUBLIQUE;

export const COOKIE_SESSION = "avc_session";

export class ErreurApi extends Error {
  constructor(
    readonly statut: number,
    message: string,
    readonly erreurs: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "ErreurApi";
  }

  /** Premier message de validation pour un champ donne. */
  champ(nom: string): string | undefined {
    return this.erreurs[nom]?.[0];
  }

  get estValidation(): boolean {
    return this.statut === 422;
  }

  get estAuthentification(): boolean {
    return this.statut === 401;
  }
}

type Options = {
  methode?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  corps?: unknown;
  formulaire?: FormData;
  jeton?: string | null;
  /** Adresse du visiteur, transmise a l'API pour ses limites de debit. */
  ipClient?: string | null;
};

/**
 * Recupere l'adresse du visiteur dans la requete entrante.
 *
 * Les pages publiques sont rendues cote serveur : sans cette transmission,
 * Laravel verrait l'adresse du serveur Next pour tout le monde, et ses
 * plafonds par IP bloqueraient l'ensemble du public. Laravel ne fait
 * confiance a cet en-tete que pour les adresses listees dans
 * TRUSTED_PROXIES.
 */
async function ipVisiteur(): Promise<string | null> {
  try {
    const entetes = await headers();
    const transmis = entetes.get("x-forwarded-for");

    return transmis?.split(",")[0]?.trim() ?? entetes.get("x-real-ip") ?? null;
  } catch {
    // Appel hors contexte de requete (script, build) : rien a transmettre.
    return null;
  }
}

async function appel<T>(chemin: string, options: Options = {}): Promise<T> {
  const { methode = "GET", corps, formulaire, jeton, ipClient } = options;

  const entetes: Record<string, string> = { Accept: "application/json" };
  if (jeton) entetes.Authorization = `Bearer ${jeton}`;
  if (corps !== undefined) entetes["Content-Type"] = "application/json";
  if (ipClient) entetes["X-Forwarded-For"] = ipClient;

  const reponse = await fetch(`${BASE}${chemin}`, {
    method: methode,
    headers: entetes,
    body: formulaire ?? (corps !== undefined ? JSON.stringify(corps) : undefined),
    // Le back-office et les statuts de paiement doivent toujours etre frais.
    cache: "no-store",
  });

  if (reponse.status === 204) return undefined as T;

  const texte = await reponse.text();
  let charge: unknown = null;

  try {
    charge = texte ? JSON.parse(texte) : null;
  } catch {
    // Laravel renvoie du JSON sur /api/*. Un corps non analysable signale
    // une erreur de plus bas niveau (serveur arrete, proxy).
    throw new ErreurApi(
      reponse.status,
      "Le serveur a renvoye une reponse inattendue. Verifiez que l'API est demarree.",
    );
  }

  if (!reponse.ok) {
    const details = charge as { message?: string; errors?: Record<string, string[]> };
    throw new ErreurApi(
      reponse.status,
      details?.message ?? "La requete a echoue.",
      details?.errors ?? {},
    );
  }

  return charge as T;
}

/* --- Espace public ---------------------------------------------------- */

export async function lirePublic<T>(chemin: string): Promise<T> {
  return appel<T>(chemin, { ipClient: await ipVisiteur() });
}

/* --- Back-office ------------------------------------------------------ */

export async function jetonSession(): Promise<string | null> {
  const magasin = await cookies();
  return magasin.get(COOKIE_SESSION)?.value ?? null;
}

/**
 * Appel authentifie. Leve une ErreurApi 401 si aucun jeton n'est present,
 * ce que le layout du back-office transforme en redirection vers la
 * connexion.
 */
export async function lireAdmin<T>(chemin: string): Promise<T> {
  const jeton = await jetonSession();

  if (!jeton) {
    throw new ErreurApi(401, "Session expiree.");
  }

  return appel<T>(chemin, { jeton, ipClient: await ipVisiteur() });
}

export async function envoyerAdmin<T>(
  chemin: string,
  options: Omit<Options, "jeton"> & { methode: Exclude<Options["methode"], "GET"> },
): Promise<T> {
  const jeton = await jetonSession();

  if (!jeton) {
    throw new ErreurApi(401, "Session expiree.");
  }

  return appel<T>(chemin, { ...options, jeton, ipClient: await ipVisiteur() });
}

/** Connexion : hors lireAdmin puisqu'il n'y a pas encore de jeton. */
export async function connexion(identifiants: {
  email: string;
  password: string;
  device_name: string;
}) {
  return appel<{ token: string; user: import("./types").Utilisateur }>(
    "/admin/login",
    { methode: "POST", corps: identifiants, ipClient: await ipVisiteur() },
  );
}

/** Construit une chaine de requete en ignorant les filtres vides. */
export function parametres(filtres: Record<string, string | number | undefined | null>): string {
  const query = new URLSearchParams();

  for (const [cle, valeur] of Object.entries(filtres)) {
    if (valeur !== undefined && valeur !== null && valeur !== "") {
      query.set(cle, String(valeur));
    }
  }

  const chaine = query.toString();
  return chaine ? `?${chaine}` : "";
}
