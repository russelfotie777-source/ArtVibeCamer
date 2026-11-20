import Image from "next/image";
import Link from "next/link";
import { nombre } from "@/lib/format";
import type { LigneClassement, ResultatCategorie } from "@/lib/types";

// Composant de podium et classement pour une categorie donnee.
// Presente les trois premiers sur une estrade a trois marches,
// suivis de la liste des rangs suivants.

function MarchePodium({
  candidat,
  rang,
  hauteurMarche,
  couleurBordure,
  fondMarche,
  afficheVoix,
}: {
  candidat: LigneClassement;
  rang: 1 | 2 | 3;
  hauteurMarche: string;
  couleurBordure: string;
  fondMarche: string;
  afficheVoix: boolean;
}) {
  const estPremier = rang === 1;

  const libelleRang = rang === 1 ? "1er" : `${rang}e`;

  return (
    <div className="flex flex-1 flex-col items-center">
      {/* Profil du candidat sur le podium */}
      <Link
        href={`/candidats/${candidat.slug}`}
        className="group flex flex-col items-center text-center transition-transform duration-200 hover:-translate-y-1"
      >
        <div
          className={`relative mb-3 overflow-hidden rounded-full border-2 ${
            estPremier
              ? "size-20 sm:size-24 border-accent shadow-md"
              : "size-16 sm:size-20 border-bordure-forte"
          } bg-surface`}
        >
          {candidat.photo_url ? (
            <Image
              src={candidat.photo_url}
              alt={candidat.name}
              fill
              sizes="96px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <span className="flex h-full items-center justify-center text-xs text-discret">
              Sans photo
            </span>
          )}
        </div>

        {candidat.candidate_number ? (
          <span className="chiffre text-xs text-accent">
            {candidat.candidate_number}
          </span>
        ) : null}

        <p className="mt-0.5 line-clamp-1 max-w-[110px] text-sm font-semibold sm:max-w-[150px] group-hover:text-lien">
          {candidat.name}
        </p>

        {afficheVoix && candidat.votes_count !== null ? (
          <p className="mt-0.5 text-xs text-discret">
            <span className="chiffre font-semibold text-fort">
              {nombre(candidat.votes_count)}
            </span>{" "}
            {candidat.votes_count > 1 ? "voix" : "voix"}
          </p>
        ) : null}
      </Link>

      {/* Marque physique du podium avec hauteur distincte */}
      <div
        className={`mt-4 flex w-full flex-col items-center justify-start rounded-t-region border-t-2 border-x ${couleurBordure} ${fondMarche} ${hauteurMarche} pt-3 transition-all duration-300`}
      >
        <span
          className={`chiffre rounded-pilule px-2.5 py-0.5 text-xs font-semibold ${
            estPremier
              ? "bg-accent text-sur-accent"
              : "bg-surface border border-bordure text-fort"
          }`}
        >
          {libelleRang}
        </span>
      </div>
    </div>
  );
}

export function PodiumCategorie({
  resultat,
  afficheVoix,
}: {
  resultat: ResultatCategorie;
  afficheVoix: boolean;
}) {
  const { category, ranking } = resultat;

  if (ranking.length === 0) {
    return (
      <div className="rounded-region border border-bordure bg-surface p-8 text-center">
        <h3 className="text-xl">{category.name}</h3>
        <p className="mt-2 text-sm text-discret">
          Aucun vote enregistré pour le moment dans cette catégorie.
        </p>
      </div>
    );
  }

  const premier = ranking.find((c) => c.position === 1);
  const deuxieme = ranking.find((c) => c.position === 2);
  const troisieme = ranking.find((c) => c.position === 3);
  const reste = ranking.filter((c) => c.position > 3);

  return (
    <section className="rounded-region border border-bordure bg-surface/50 p-6 sm:p-8">
      {/* En-tete de la categorie */}
      <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-bordure pb-6">
        <div>
          <h2 className="text-3xl tracking-affiche text-fort">{category.name}</h2>
          <p className="mt-1 text-sm text-discret">
            <span className="chiffre">{category.candidates_count}</span> candidat
            {category.candidates_count > 1 ? "s" : ""}
            {afficheVoix && category.votes_count !== null ? (
              <>
                {" "}· <span className="chiffre">{nombre(category.votes_count)}</span> voix au total
              </>
            ) : null}
          </p>
        </div>

        <Link
          href={`/candidats?categorie=${category.slug}`}
          className="text-sm text-lien underline decoration-1 underline-offset-4 hover:text-accent"
        >
          Voir les candidats de la catégorie →
        </Link>
      </div>

      {/* Podium des trois premiers */}
      {premier ? (
        <div className="mt-8 flex items-end justify-center gap-2 sm:gap-6 border-b border-bordure pb-4">
          {/* 2e place (gauche) */}
          {deuxieme ? (
            <MarchePodium
              candidat={deuxieme}
              rang={2}
              hauteurMarche="h-28 sm:h-36"
              couleurBordure="border-bordure-forte"
              fondMarche="bg-appui"
              afficheVoix={afficheVoix}
            />
          ) : (
            <div className="flex-1" />
          )}

          {/* 1ere place (centre) */}
          <MarchePodium
            candidat={premier}
            rang={1}
            hauteurMarche="h-36 sm:h-48"
            couleurBordure="border-accent"
            fondMarche="bg-accent/15"
            afficheVoix={afficheVoix}
          />

          {/* 3e place (droite) */}
          {troisieme ? (
            <MarchePodium
              candidat={troisieme}
              rang={3}
              hauteurMarche="h-20 sm:h-28"
              couleurBordure="border-bordure"
              fondMarche="bg-surface"
              afficheVoix={afficheVoix}
            />
          ) : (
            <div className="flex-1" />
          )}
        </div>
      ) : null}

      {/* Rangs suivants (4e et au-dela) */}
      {reste.length > 0 ? (
        <div className="mt-6">
          <h3 className="text-xs uppercase tracking-wider text-discret mb-3">
            Suite du classement
          </h3>

          <div className="divide-y divide-bordure overflow-hidden rounded-controle border border-bordure bg-surface">
            {reste.map((c) => (
              <div
                key={c.slug}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm transition-colors hover:bg-appui"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="chiffre w-6 text-center text-sm font-semibold text-discret">
                    {c.position}
                  </span>

                  <div className="relative size-8 shrink-0 overflow-hidden rounded-full border border-bordure bg-surface">
                    {c.photo_url ? (
                      <Image
                        src={c.photo_url}
                        alt={c.name}
                        fill
                        sizes="32px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-[10px] text-discret">
                        —
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <Link
                      href={`/candidats/${c.slug}`}
                      className="line-clamp-1 font-semibold text-fort hover:text-lien"
                    >
                      {c.name}
                    </Link>
                    {c.candidate_number ? (
                      <p className="chiffre text-xs text-accent">
                        {c.candidate_number}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {afficheVoix && c.votes_count !== null ? (
                    <span className="chiffre text-discret">
                      <span className="font-semibold text-fort">{nombre(c.votes_count)}</span> voix
                    </span>
                  ) : null}

                  <Link
                    href={`/candidats/${c.slug}/voter`}
                    className="appui hidden sm:inline-flex h-8 items-center rounded-controle border border-bordure-forte px-2.5 text-xs text-fort hover:border-fort hover:bg-appui"
                  >
                    Voter
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
