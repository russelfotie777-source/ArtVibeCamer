import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoEvenement } from "@/components/Marque";
import { BoutonDeconnexion } from "@/components/admin/BoutonDeconnexion";
import { NavAdmin } from "@/components/admin/NavAdmin";
import { ErreurApi, lireAdmin } from "@/lib/api";
import type { Utilisateur } from "@/lib/types";

export const metadata: Metadata = {
  title: { default: "Organisation", template: "%s — Organisation" },
  robots: { index: false, follow: false },
};

export default async function LayoutAdmin({
  children,
}: {
  children: React.ReactNode;
}) {
  let utilisateur: Utilisateur;

  try {
    const reponse = await lireAdmin<{ user: Utilisateur }>("/admin/me");
    utilisateur = reponse.user;
  } catch (erreur) {
    if (erreur instanceof ErreurApi && (erreur.estAuthentification || erreur.statut === 403)) {
      redirect("/connexion");
    }
    throw erreur;
  }

  /*
   * Un agent de scan n'a acces qu'au controle a l'entree : il n'a rien a voir
   * des recettes ni des coordonnees des candidats.
   */
  if (!utilisateur.capabilities.back_office) {
    return (
      <main className="terrain-sombre flex min-h-dvh items-center px-4 py-16">
        <div className="mx-auto w-full max-w-md">
          <h1 className="text-4xl tracking-affiche">Accès réservé</h1>
          <p className="mt-4">
            Votre compte «&nbsp;{utilisateur.role_label}&nbsp;» donne accès au
            contrôle des billets à l’entrée, pas au suivi de
            l’événement.
          </p>
          <div className="mt-6 -ml-3">
            <BoutonDeconnexion />
          </div>
        </div>
      </main>
    );
  }

  /*
   * Coque de travail : barre laterale aux couleurs de la marque, zone de
   * travail claire, lisible de jour. Sur telephone, la barre devient un
   * bandeau et la navigation defile a l'horizontale.
   */
  return (
    <div className="terrain-clair flex min-h-dvh flex-col bg-coque lg:flex-row">
      <aside className="terrain-sombre flex flex-col border-bordure lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:shrink-0 lg:border-r">
        <div className="flex h-16 items-center justify-between gap-4 px-4">
          <LogoEvenement hauteur={40} href="/admin" />
          <div className="lg:hidden">
            <BoutonDeconnexion />
          </div>
        </div>

        <div className="px-2 pb-2 lg:flex-1 lg:pt-4">
          <NavAdmin />
        </div>

        <div className="hidden border-t border-bordure p-4 lg:block">
          <p className="truncate text-sm font-semibold text-fort" title={utilisateur.name}>
            {utilisateur.name}
          </p>
          <p className="text-xs text-discret">{utilisateur.role_label}</p>
          <div className="mt-2 -ml-3">
            <BoutonDeconnexion />
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:py-10">{children}</main>
    </div>
  );
}
