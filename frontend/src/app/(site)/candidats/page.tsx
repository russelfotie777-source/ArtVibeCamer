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
    "Découvrez les candidats d'ArtVibeCamer : danse, chant, comédie, Miss & Master.",
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

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
      <header className="prose-etroit">
        <h1 className="font-display text-display font-extrabold">
          Les candidats
        </h1>
        <p className="mt-5 text-lg text-ink-soft">
          Celles et ceux qui ont franchi le pas. Les votes du public ouvriront
          après les castings.
        </p>
      </header>

      {/* Filtre par discipline : l'etat vit dans l'URL, donc une selection
          se partage par lien. */}
      {categories.length > 0 ? (
        <nav className="mt-10 flex flex-wrap gap-2" aria-label="Disciplines">
          <Link
            href={lien({ categorie: undefined, page: undefined })}
            aria-current={!filtres.categorie ? "page" : undefined}
            className={`controle border px-4 py-2 text-sm transition-colors ${
              !filtres.categorie
                ? "border-brass bg-brass text-ink"
                : "border-ink-line text-ink-soft hover:border-brass hover:text-brass"
            }`}
          >
            Toutes
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={lien({ categorie: c.slug, page: undefined })}
              aria-current={filtres.categorie === c.slug ? "page" : undefined}
              className={`controle border px-4 py-2 text-sm transition-colors ${
                filtres.categorie === c.slug
                  ? "border-brass bg-brass text-ink"
                  : "border-ink-line text-ink-soft hover:border-brass hover:text-brass"
              }`}
            >
              {c.name}
            </Link>
          ))}
        </nav>
      ) : null}

      {candidats === null ? (
        <p className="mt-12 border border-ink-line bg-ink-raised px-6 py-10 text-sm text-ink-soft">
          La liste n&apos;est pas joignable pour le moment. Réessayez dans
          quelques minutes.
        </p>
      ) : candidats.data.length === 0 ? (
        <div className="mt-12 border border-ink-line bg-ink-raised px-6 py-12">
          <h2 className="font-display text-xl font-extrabold">
            Aucun candidat pour l&apos;instant
          </h2>
          <p className="prose-etroit mt-2 text-sm text-ink-soft">
            Les profils apparaissent dès que l&apos;organisation a validé les
            dossiers. Soyez le premier de votre discipline.
          </p>
          <LienBouton href="/inscription" className="mt-6">
            Inscrire mon talent
          </LienBouton>
        </div>
      ) : (
        <>
          <ul className="mt-12 grid gap-px border border-ink-line bg-ink-line sm:grid-cols-2 lg:grid-cols-4">
            {candidats.data.map((candidat) => (
              <li key={candidat.id} className="bg-ink">
                <VignetteCandidat candidat={candidat} />
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-ink-soft">
              <span className="chiffre">{nombre(candidats.meta.total)}</span>{" "}
              candidat{candidats.meta.total > 1 ? "s" : ""}
            </p>

            {candidats.meta.last_page > 1 ? (
              <div className="flex items-center gap-3">
                {candidats.meta.current_page > 1 ? (
                  <LienBouton
                    href={lien({ page: String(candidats.meta.current_page - 1) })}
                    ton="contour-clair"
                    taille="petit"
                  >
                    Précédent
                  </LienBouton>
                ) : null}
                <span className="chiffre text-xs text-ink-soft">
                  Page {candidats.meta.current_page} / {candidats.meta.last_page}
                </span>
                {candidats.meta.current_page < candidats.meta.last_page ? (
                  <LienBouton
                    href={lien({ page: String(candidats.meta.current_page + 1) })}
                    ton="contour-clair"
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
