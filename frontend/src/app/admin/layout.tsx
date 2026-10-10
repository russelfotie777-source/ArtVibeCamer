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
      <div className="flex min-h-full items-center justify-center bg-ink px-5 py-16 text-paper">
        <div className="max-w-md">
          <h1 className="font-display text-display-sm font-extrabold">
            Accès réservé
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-ink-soft">
            Votre compte « {utilisateur.role_label} » donne accès au contrôle
            des billets à l&apos;entrée, pas au suivi de l&apos;événement.
          </p>
          <div className="mt-7">
            <BoutonDeconnexion />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink lg:flex-row">
      {/* Chrome indigo : le back-office garde l'identite du site tout en
          travaillant sur un fond papier, lisible de jour. */}
      <aside className="bg-ink text-paper lg:w-60 lg:shrink-0">
        <div className="flex items-center justify-between gap-4 px-5 py-5 lg:block">
          <LogoEvenement hauteur={38} href="/admin" />
          <p className="mt-0.5 hidden text-xs text-ink-soft lg:block">
            Organisation
          </p>
        </div>

        <div className="px-3 pb-4 lg:mt-4">
          <NavAdmin />
        </div>

        <div className="hidden border-t border-ink-line px-5 py-4 lg:block">
          <p className="truncate text-sm font-medium">{utilisateur.name}</p>
          <p className="text-xs text-ink-soft">{utilisateur.role_label}</p>
          <div className="mt-2 -ml-2">
            <BoutonDeconnexion />
          </div>
        </div>
      </aside>

      <div className="flex-1">
        <div className="flex items-center justify-between gap-4 border-b border-rule px-5 py-3 lg:hidden">
          <p className="truncate text-sm">{utilisateur.name}</p>
          <div className="[&_button]:text-paper-soft">
            <BoutonDeconnexion />
          </div>
        </div>

        <main className="px-5 py-8 sm:px-8 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
