"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { envoyerAdmin, ErreurApi, lireAdmin } from "@/lib/api";
import { fermerSession } from "@/lib/session";
import type { ReponseScan, ReponseStatsScan } from "@/lib/types";

export type Retour = { succes?: string; erreur?: string };

export async function seDeconnecter(): Promise<void> {
  try {
    await envoyerAdmin("/admin/logout", { methode: "POST" });
  } catch {
    // Jeton deja invalide cote serveur : on nettoie quand meme le cookie.
  }

  await fermerSession();
  redirect("/connexion");
}

/** Message d'erreur lisible, quelle que soit la cause. */
function lire(erreur: unknown, repli: string): string {
  if (erreur instanceof ErreurApi) {
    return erreur.message || repli;
  }
  return "Impossible de joindre le serveur. Réessayez.";
}

export async function validerCandidat(
  _etat: Retour,
  donnees: FormData,
): Promise<Retour> {
  const id = String(donnees.get("id") ?? "");

  try {
    await envoyerAdmin(`/admin/candidates/${id}/approve`, { methode: "POST" });
  } catch (erreur) {
    return { erreur: lire(erreur, "La validation a échoué.") };
  }

  revalidatePath("/admin/candidats");
  revalidatePath(`/admin/candidats/${id}`);
  revalidatePath("/admin");

  return { succes: "Candidat validé." };
}

export async function rejeterCandidat(
  _etat: Retour,
  donnees: FormData,
): Promise<Retour> {
  const id = String(donnees.get("id") ?? "");
  const reason = String(donnees.get("reason") ?? "").trim();

  if (!reason) {
    return { erreur: "Indiquez le motif du rejet : le candidat doit savoir pourquoi." };
  }

  try {
    await envoyerAdmin(`/admin/candidates/${id}/reject`, {
      methode: "POST",
      corps: { reason },
    });
  } catch (erreur) {
    return { erreur: lire(erreur, "Le rejet a échoué.") };
  }

  revalidatePath("/admin/candidats");
  revalidatePath(`/admin/candidats/${id}`);
  revalidatePath("/admin");

  return { succes: "Candidat rejeté." };
}

/**
 * Verification d'un paiement aupres de la passerelle.
 *
 * C'est la reponse a un candidat qui affirme avoir ete debite sans que son
 * inscription soit enregistree : plutot que de valider a la main, on
 * redemande son etat a l'operateur, qui fait foi.
 */
export async function verifierPaiement(
  _etat: Retour,
  donnees: FormData,
): Promise<Retour> {
  const reference = String(donnees.get("reference") ?? "");

  try {
    const reponse = await envoyerAdmin<{ message: string }>(
      `/admin/transactions/${reference}/verify`,
      { methode: "POST" },
    );

    revalidatePath("/admin/paiements");
    revalidatePath("/admin");

    return { succes: reponse.message };
  } catch (erreur) {
    return { erreur: lire(erreur, "La vérification a échoué.") };
  }
}

// Controle d'un billet a l'entree : accepte le jeton QR ou le code court de secours.
export async function scannerBillet(
  code: string,
  gate?: string | null,
): Promise<ReponseScan> {
  try {
    return await envoyerAdmin<ReponseScan>("/admin/scan", {
      methode: "POST",
      corps: {
        code: code.trim(),
        gate: gate?.trim() || null,
      },
    });
  } catch (erreur) {
    if (erreur instanceof ErreurApi) {
      return {
        granted: false,
        result: "not_found",
        message: erreur.message || "Billet inconnu ou non reconnu.",
        ticket: null,
      };
    }
    return {
      granted: false,
      result: "not_found",
      message: "Impossible de joindre le serveur de contrôle.",
      ticket: null,
    };
  }
}

// Chargement des statistiques de scan en direct et de l'historique recent.
export async function chargerStatsScan(): Promise<ReponseStatsScan | null> {
  try {
    return await lireAdmin<ReponseStatsScan>("/admin/scan/stats");
  } catch {
    return null;
  }
}
