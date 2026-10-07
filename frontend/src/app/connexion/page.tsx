import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FormulaireConnexion } from "@/components/FormulaireConnexion";
import { BandeMotif } from "@/components/Motif";
import { jetonSession } from "@/lib/api";

export const metadata: Metadata = {
  title: "Connexion",
  robots: { index: false, follow: false },
};

export default async function PageConnexion() {
  // Une session valide n'a rien a faire sur l'ecran de connexion.
  if (await jetonSession()) redirect("/admin");

  return (
    <div className="flex min-h-dvh flex-col bg-ink text-paper">
      <BandeMotif hauteur={12} />

      <div className="flex flex-1 items-center justify-center px-5 py-16">
        <div className="w-full max-w-sm">
          <Link
            href="/"
            className="font-display text-xl font-extrabold tracking-tight"
          >
            ArtVibeCamer
          </Link>

          <h1 className="mt-10 font-display text-display-sm font-extrabold">
            Espace organisation
          </h1>
          <p className="mt-3 text-sm text-ink-soft">
            Suivi des inscriptions, des paiements et des candidats.
          </p>

          <div className="mt-9">
            <FormulaireConnexion />
          </div>

          <p className="mt-8 text-xs leading-relaxed text-ink-soft/80">
            Les comptes sont créés par l&apos;administrateur. Si vous n&apos;en
            avez pas, demandez-lui de vous en ouvrir un.
          </p>
        </div>
      </div>
    </div>
  );
}
