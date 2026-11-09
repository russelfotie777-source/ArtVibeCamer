import type { Metadata } from "next";
import Link from "next/link";
import { LienBouton } from "@/components/ui/Bouton";
import { lirePublic, parametres } from "@/lib/api";
import { nombre } from "@/lib/format";
import type { Candidat, Categorie, Page } from "@/lib/types";
import { VignetteCandidat } from "@/components/VignetteCandidat";

export const metadata: Metadata = {
  title: "Les candidats",
  description:
    "Les candidats d’ArtVibeCamer en danse, chant, comédie et Miss & Master.",
};

export default async function PageCandidats({
  searchParams,
}: {
  searchParams: Promise<{ categorie?: string; search?: string; page?: string }>;
}) {
  const filtres = await searchParams;

  let candidats: Page<Candidat> | null = null;
  let categories: Categorie[] = [];

  try {
    const [liste, cats] = await Promise.all([
      lirePublic<Page<Candidat>>(
        `/candidates${parametres({
          category: filtres.categorie,
          search: filtres.search,
          page: filtres.page,
          per_page: 24,
        })}`,
      ),
      lirePublic<{ data: Categorie[] }>("/categories"),
    ]);
    candidats = liste;
    categories = cats.data;
  } catch {
    // Page lisible meme si l'API ne repond pas.
  }

  const lien = (params: Record<string, string | undefined>) =>
    `/candidats${parametres({ ...filtres, ...params })}`;

  const inscriptionsOuvertes = categories.some((c) => c.is_registration_open);
  const votesOuverts = categories.some((c) => c.is_voting_open);
  const discipline = categories.find((c) => c.slug === filtres.categorie);

  const filtre = (actif: boolean) =>
    `appui inline-flex h-8 items-center rounded-controle px-3 text-sm whitespace-nowrap ${
      actif
        ? "bg-accent font-semibold text-sur-accent"
        : "border border-bordure text-texte hover:border-bordure-forte hover:text-fort"
    }`;

  return (
    <div className="cadre py-12 md:py-16">
      <header className="max-w-2xl">
        <h1 className="text-6xl tracking-affiche">Les candidats</h1>
        <p className="mt-4 text-lg">
          Les talents dont l’organisation a validé le dossier.
          {votesOuverts ? "" : " Les votes du public ouvriront après les castings."}
        </p>
      </header>

      {/* Filtre par discipline : l'etat vit dans l'URL, donc une selection
          se partage par lien. */}
      {categories.length > 0 ? (
        <nav aria-label="Disciplines" className="mt-8">
          <ul className="flex flex-wrap gap-2">
            <li>
              <Link
                href={lien({ categorie: undefined, page: undefined })}
                aria-current={!filtres.categorie ? "page" : undefined}
                className={filtre(!filtres.categorie)}
              >
                Toutes
              </Link>
            </li>
            {categories.map((c) => (
              <li key={c.id}>
                <Link
                  href={lien({ categorie: c.slug, page: undefined })}
                  aria-current={filtres.categorie === c.slug ? "page" : undefined}
                  className={filtre(filtres.categorie === c.slug)}
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {candidats === null ? (
        <div role="alert" className="mt-8 rounded-region border border-bordure px-6 py-12 text-center">
          <h2 className="text-xl">La liste ne répond pas</h2>
          <p className="mt-2 text-discret">
            Rechargez la page dans quelques minutes.
          </p>
        </div>
      ) : candidats.data.length === 0 ? (
        <div className="mt-8 flex flex-col items-center rounded-region border border-bordure px-6 py-16 text-center">
          <h2 className="text-xl">
            {discipline ? `Aucun candidat en ${discipline.name}` : "Aucun candidat pour l’instant"}
          </h2>
          <p className="mt-2 max-w-md text-discret">
            {inscriptionsOuvertes
              ? "Inscrivez votre talent : les profils paraissent ici dès que l’organisation a validé le dossier."
              : "Revenez après la validation des dossiers par l’organisation."}
          </p>
          {inscriptionsOuvertes ? (
            <LienBouton
              href={discipline ? `/inscription?categorie=${discipline.slug}` : "/inscription"}
              className="mt-6"
            >
              Inscrire mon talent
            </LienBouton>
          ) : null}
        </div>
      ) : (
        <>
          {/* Un candidat est un objet a part entiere : une carte chacun, et une rangee
              incomplete ne laisse pas de case vide. */}
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {candidats.data.map((candidat) => (
              <li key={candidat.id} className="min-w-0 overflow-hidden rounded-region border border-bordure">
                <VignetteCandidat candidat={candidat} />
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-sm">
            <p className="text-discret">
              <span className="chiffre text-fort">{nombre(candidats.meta.total)}</span>{" "}
              candidat{candidats.meta.total > 1 ? "s" : ""}
            </p>

            {candidats.meta.last_page > 1 ? (
              <div className="flex items-center gap-2">
                {candidats.meta.current_page > 1 ? (
                  <LienBouton
                    href={lien({ page: String(candidats.meta.current_page - 1) })}
                    ton="secondaire"
                    taille="petit"
                  >
                    Précédent
                  </LienBouton>
                ) : null}
                <span className="chiffre px-2 text-discret">
                  Page {candidats.meta.current_page} sur {candidats.meta.last_page}
                </span>
                {candidats.meta.current_page < candidats.meta.last_page ? (
                  <LienBouton
                    href={lien({ page: String(candidats.meta.current_page + 1) })}
                    ton="secondaire"
                    taille="petit"
                  >
                    Suivant
                  </LienBouton>
                ) : null}
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
