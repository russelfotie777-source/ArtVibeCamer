import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GestionReglages } from "@/components/admin/GestionReglages";
import { ErreurApi, lireAdmin } from "@/lib/api";
import type { ReglageItem, Utilisateur } from "@/lib/types";

export const metadata: Metadata = {
  title: "Réglages de l'événement — Back-office",
};

export default async function PageReglagesAdmin() {
  let utilisateur: Utilisateur;
  try {
    const me = await lireAdmin<{ user: Utilisateur }>("/admin/me");
    utilisateur = me.user;
  } catch (erreur) {
    if (erreur instanceof ErreurApi && (erreur.estAuthentification || erreur.statut === 403)) {
      redirect("/connexion");
    }
    throw erreur;
  }

  if (!utilisateur.capabilities.back_office) {
    redirect("/admin");
  }

  const reponse = await lireAdmin<{ data: ReglageItem[] }>("/admin/settings").catch(() => ({
    data: [],
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-affiche text-fort">
            Réglages globaux de l’événement
          </h1>
          <p className="mt-1 text-sm text-discret">
            Pilotez les interrupteurs en direct (inscriptions, votes, billetterie, résultats) et les paramètres généraux.
          </p>
        </div>
      </div>

      <GestionReglages
        reglagesInitiaux={reponse.data}
        peutGerer={utilisateur.capabilities.manage}
      />
    </div>
  );
}
