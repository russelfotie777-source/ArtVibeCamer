"use server";

import { redirect } from "next/navigation";
import { connexion, ErreurApi } from "@/lib/api";
import { ouvrirSession } from "@/lib/session";

export type EtatConnexion = { message?: string };

/**
 * Connexion au back-office.
 *
 * Le jeton renvoye par l'API est pose dans un cookie httpOnly cote serveur :
 * il n'est jamais remis au JavaScript de la page.
 */
export async function seConnecter(
  _etat: EtatConnexion,
  donnees: FormData,
): Promise<EtatConnexion> {
  const email = String(donnees.get("email") ?? "").trim();
  const password = String(donnees.get("password") ?? "");

  if (!email || !password) {
    return { message: "Renseignez votre email et votre mot de passe." };
  }

  try {
    const { token } = await connexion({
      email,
      password,
      // Un jeton par poste : revoquer un appareil perdu ne deconnecte pas
      // le reste de l'equipe.
      device_name: "back-office-web",
    });

    await ouvrirSession(token);
  } catch (erreur) {
    if (erreur instanceof ErreurApi) {
      return {
        message:
          erreur.champ("email") ??
          (erreur.statut === 429
            ? "Trop de tentatives. Patientez quelques minutes."
            : erreur.message),
      };
    }

    return {
      message:
        "Impossible de joindre le serveur. Vérifiez que l'API est démarrée.",
    };
  }

  // redirect() leve une exception de controle : elle doit rester hors du try.
  redirect("/admin");
}
