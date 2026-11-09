import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormulaireVote } from "@/components/FormulaireVote";
import { ErreurApi, lirePublic } from "@/lib/api";
import { nombre } from "@/lib/format";
import type { Candidat } from "@/lib/types";

type Reponse = { data: Candidat };

async function candidat(slug: string): Promise<Candidat | null> {
  try {
    const reponse = await lirePublic<Reponse>(
      `/candidates/${encodeURIComponent(slug)}`,
    );

    return reponse.data;
  } catch (erreur) {
    if (erreur instanceof ErreurApi && erreur.statut === 404) return null;
    throw erreur;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = await candidat(slug);

  return c
    ? { title: `Voter pour ${c.display_name}` }
    : { title: "Candidat introuvable" };
}

export default async function PageVote({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = await candidat(slug);

  if (!c) notFound();

  /*
   * La cloture des votes est verifiee ici plutot que de laisser le formulaire
   * partir pour rien : l'API refuserait de toute facon, mais apres que le
   * votant a saisi son numero.
   */
  const ouverts = c.is_votable && (c.category?.is_voting_open ?? false);

  return (
    <div className="terrain-clair">
      <div className="cadre py-12 md:py-16">
        <nav aria-label="Fil d’Ariane" className="text-sm">
          <Link
            href={`/candidats/${c.slug}`}
            className="text-discret underline decoration-bordure-forte underline-offset-4 transition-colors hover:text-lien hover:decoration-lien"
          >
            {c.display_name}
          </Link>
        </nav>

        <div className="max-w-xl">
          <h1 className="mt-6 text-5xl tracking-affiche">
            Voter pour {c.display_name}
          </h1>

          <p className="mt-4 text-discret">
            {c.candidate_number ? (
              <>
                <span className="chiffre">{c.candidate_number}</span> ·{" "}
              </>
            ) : null}
            {c.category?.name}
            {c.city ? `, ${c.city}` : ""} ·{" "}
            <span className="chiffre">{nombre(c.votes_count)}</span> voix reçues
          </p>

          <div className="mt-10">
            {ouverts ? (
              <FormulaireVote candidat={c} />
            ) : (
              <div className="rounded-region border border-bordure p-6">
                <h2 className="text-xl">Les votes sont fermés</h2>
                <p className="mt-2 text-discret">
                  Le scrutin n’est pas ouvert pour cette catégorie. Revenez à
                  l’ouverture des votes, annoncée après les castings.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
