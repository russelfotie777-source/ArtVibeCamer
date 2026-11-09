import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoEvenement } from "@/components/Marque";
import { FormulaireConnexion } from "@/components/FormulaireConnexion";
import { ErreurApi, jetonSession, lireAdmin } from "@/lib/api";

export const metadata: Metadata = {
  title: "Connexion",
  robots: { index: false, follow: false },
};

export default async function PageConnexion() {
  /*
   * Ne pas confondre presence et validite du cookie. Un jeton revoque ou un
   * compte desactive doit pouvoir revenir au formulaire, sinon /admin et
   * /connexion se redirigent mutuellement sans fin.
   */
  if (await jetonSession()) {
    let sessionValide = false;

    try {
      await lireAdmin("/admin/me");
      sessionValide = true;
    } catch (erreur) {
      if (
        !(erreur instanceof ErreurApi) ||
        (!erreur.estAuthentification && erreur.statut !== 403)
      ) {
        throw erreur;
      }
    }

    if (sessionValide) redirect("/admin");
  }

  return (
    <main className="terrain-sombre flex min-h-dvh items-center px-4 py-16">
      <div className="mx-auto w-full max-w-sm">
        <LogoEvenement hauteur={48} priorite />

        <h1 className="mt-12 text-4xl tracking-affiche">Espace organisation</h1>
        <p className="mt-2 text-discret">
          Inscriptions, paiements et dossiers des candidats.
        </p>

        <div className="mt-8">
          <FormulaireConnexion />
        </div>

        <p className="mt-8 text-sm text-discret">
          Pas de compte&nbsp;? Demandez à l’administrateur de vous en
          ouvrir un.
        </p>
      </div>
    </main>
  );
}
