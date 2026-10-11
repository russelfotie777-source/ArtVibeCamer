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
    <div className="mx-auto w-full max-w-xl px-5 py-16">
      <Link
        href={`/candidats/${c.slug}`}
        className="text-sm text-paper-soft underline decoration-rule underline-offset-4 hover:decoration-ink"
      >
        Retour à la fiche
      </Link>

      <h1 className="mt-6 font-display text-display-sm font-extrabold">
        Voter pour {c.display_name}
      </h1>

      <p className="prose-etroit mt-2 text-paper-soft">
        {c.category?.name}
        {c.city ? `, ${c.city}` : ""} · {nombre(c.votes_count)} voix reçues
      </p>

      <div className="mt-10">
        {ouverts ? (
          <FormulaireVote candidat={c} />
        ) : (
          <div className="panneau border border-rule bg-paper-raised p-8">
            <h2 className="font-display text-xl font-extrabold">
              Les votes sont fermés
            </h2>
            <p className="prose-etroit mt-2 text-paper-soft">
              Le scrutin n&apos;est pas ouvert pour cette catégorie. Revenez à
              l&apos;ouverture des votes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
