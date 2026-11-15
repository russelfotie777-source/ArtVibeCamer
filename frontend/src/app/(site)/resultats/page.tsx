import type { Metadata } from "next";
import Link from "next/link";
import { ErreurApi, lirePublic, parametres } from "@/lib/api";
import { dateHeure } from "@/lib/format";
import type { ReponseResultats } from "@/lib/types";
import { PodiumCategorie } from "@/components/PodiumCategorie";

export const metadata: Metadata = {
  title: "Résultats & Classements",
  description:
    "Découvrez les classements officiels et les podiums des votes pour chaque catégorie d'ArtVibeCamer.",
};

// Page publique des resultats et classements.
// Affiche le podium par categorie si les resultats sont ouverts au public.
// Gere le cas 403 ou results_public = false avec un ecran d'attente soigne.
export default async function PageResultats({
  searchParams,
}: {
  searchParams: Promise<{ categorie?: string }>;
}) {
  const filtres = await searchParams;

  let resultats: ReponseResultats | null = null;
  let nonPublie = false;

  try {
    resultats = await lirePublic<ReponseResultats>("/results");
  } catch (erreur) {
    if (erreur instanceof ErreurApi && erreur.statut === 403) {
      nonPublie = true;
    } else {
      // En cas d'erreur reseau ou serveur, on considere egalement non publie ou indisponible.
      nonPublie = true;
    }
  }

  // Cas ou l'organisation n'a pas encore rendu les resultats publics.
  if (nonPublie || !resultats) {
    return (
      <div className="cadre py-12 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="chiffre rounded-pilule border border-alerte/30 bg-alerte-fond px-3 py-1 text-xs font-semibold text-alerte">
            Proclamation prochaine
          </span>

          <h1 className="mt-4 text-5xl tracking-affiche text-fort">
            Les résultats ne sont pas encore publiés
          </h1>

          <p className="mt-4 text-lg text-discret">
            Le dépouillement officiel et l’annonce des classements auront lieu
            à l’issue de la période de vote. Revenez très bientôt pour célébrer
            les lauréats d’ArtVibeCamer.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/candidats"
              className="appui inline-flex h-12 items-center rounded-controle bg-accent px-6 text-sm font-semibold text-sur-accent hover:bg-accent-survol"
            >
              Découvrir les candidats
            </Link>

            <Link
              href="/"
              className="appui inline-flex h-12 items-center rounded-controle border border-bordure-forte px-6 text-sm text-fort hover:border-fort hover:bg-appui"
            >
              Retour à l’accueil
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { data: categoriesResultats, meta } = resultats;

  const categorieSelectionnee = filtres.categorie
    ? categoriesResultats.find((c) => c.category.slug === filtres.categorie)
    : null;

  const categoriesAffichees = categorieSelectionnee
    ? [categorieSelectionnee]
    : categoriesResultats;

  const filtre = (actif: boolean) =>
    `appui inline-flex h-8 items-center rounded-controle px-3 text-sm whitespace-nowrap ${
      actif
        ? "bg-accent font-semibold text-sur-accent"
        : "border border-bordure text-texte hover:border-bordure-forte hover:text-fort"
    }`;

  return (
    <div className="cadre py-12 md:py-16">
      <header className="max-w-2xl">
        <h1 className="text-6xl tracking-affiche text-fort">Classements & Résultats</h1>
        <p className="mt-4 text-lg text-discret">
          Suivez en direct l’évolution des votes et les podiums officiels par catégorie.
        </p>

        {!meta.show_vote_counts ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded-region border border-bordure bg-surface px-4 py-2 text-xs text-discret">
            <span>🔒</span>
            <span>
              Le total exact des voix est temporairement masqué pour préserver le suspense jusqu’à la proclamation finale.
            </span>
          </div>
        ) : null}
      </header>

      {/* Filtres par categorie */}
      {categoriesResultats.length > 1 ? (
        <nav aria-label="Catégories" className="mt-8">
          <ul className="flex flex-wrap gap-2">
            <li>
              <Link
                href="/resultats"
                aria-current={!filtres.categorie ? "page" : undefined}
                className={filtre(!filtres.categorie)}
              >
                Toutes les catégories
              </Link>
            </li>
            {categoriesResultats.map((cr) => (
              <li key={cr.category.id}>
                <Link
                  href={`/resultats${parametres({ categorie: cr.category.slug })}`}
                  aria-current={filtres.categorie === cr.category.slug ? "page" : undefined}
                  className={filtre(filtres.categorie === cr.category.slug)}
                >
                  {cr.category.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {/* Grille des categories et podiums */}
      <div className="mt-8 grid gap-12">
        {categoriesAffichees.map((cr) => (
          <PodiumCategorie
            key={cr.category.id}
            resultat={cr}
            afficheVoix={meta.show_vote_counts}
          />
        ))}
      </div>

      <footer className="mt-12 border-t border-bordure pt-6 text-xs text-discret flex flex-wrap justify-between items-center gap-4">
        <p>
          Dernière mise à jour du classement :{" "}
          <span className="chiffre text-fort">{dateHeure(meta.updated_at)}</span>
        </p>
        <p>Scrutin sécurisé et audité par l’organisation ArtVibeCamer.</p>
      </footer>
    </div>
  );
}
