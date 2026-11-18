import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GestionBilletterie } from "@/components/admin/GestionBilletterie";
import { ErreurApi, lireAdmin } from "@/lib/api";
import type { TypeBilletAdmin, Utilisateur } from "@/lib/types";

export const metadata: Metadata = {
  title: "Billetterie & Jauges — Back-office",
};

export default async function PageBilletterieAdmin() {
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

  const reponse = await lireAdmin<{ data: TypeBilletAdmin[] }>("/admin/ticket-types").catch(() => ({
    data: [],
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-affiche text-fort">
            Gestion de la billetterie & jauges
          </h1>
          <p className="mt-1 text-sm text-discret">
            Suivi des ventes en direct, places réservées et ajustement des jauges maximales par catégorie de place.
          </p>
        </div>
      </div>

      <GestionBilletterie
        billetsInitiaux={reponse.data}
        peutGerer={utilisateur.capabilities.manage}
      />
    </div>
  );
}
