import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LienBouton } from "@/components/ui/Bouton";
import { ErreurApi, lirePublic } from "@/lib/api";
import { nombre } from "@/lib/format";
import type { Candidat } from "@/lib/types";

type Reponse = {
  data: Candidat;
  meta?: { rank: number; category_candidates: number };
};

async function candidat(slug: string): Promise<Reponse | null> {
  try {
    return await lirePublic<Reponse>(`/candidates/${encodeURIComponent(slug)}`);
  } catch (erreur) {
    if (erreur instanceof ErreurApi && erreur.statut === 404) return null;
    throw erreur;
  }
}

/*
 * Metadonnees par candidat : le partage WhatsApp et Facebook est le principal
 * moteur des votes. Un apercu qui montre le nom, le numero et la photo vaut
 * mieux qu'un lien nu.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const reponse = await candidat(slug);

  if (!reponse) return { title: "Candidat introuvable" };

  const c = reponse.data;
  const titre = c.candidate_number
    ? `${c.display_name} — ${c.candidate_number}`
    : c.display_name;

  return {
    title: titre,
    description:
      c.presentation?.slice(0, 160) ??
      `${c.display_name} concourt en ${c.category?.name} à ArtVibeCamer.`,
    openGraph: {
      title: titre,
      description: c.category?.name ?? "ArtVibeCamer",
      images: c.photo_url ? [{ url: c.photo_url }] : undefined,
    },
  };
}

export default async function PageCandidat({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const reponse = await candidat(slug);

  if (!reponse) notFound();

  const c = reponse.data;
  const votesOuverts = c.category?.is_voting_open === true;
  const reseaux = Object.entries(c.socials ?? {}).filter(([, url]) => Boolean(url));

  return (
    <div className="cadre py-12 md:py-16">
      <nav aria-label="Fil d’Ariane" className="text-sm">
        <Link
          href="/candidats"
          className="text-discret underline decoration-bordure-forte underline-offset-4 transition-colors hover:text-lien hover:decoration-lien"
        >
          Les candidats
        </Link>
      </nav>

      <div className="mt-8 grid gap-12 lg:grid-cols-[22rem_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-8">
        {/* Sur telephone, l'identite passe avant la photo : on sait qui on regarde. */}
        <header className="lg:col-start-2 lg:row-start-1">
          {c.candidate_number ? (
            <p className="chiffre text-base font-semibold text-accent">
              {c.candidate_number}
            </p>
          ) : null}

          <h1 className="mt-2 text-6xl tracking-affiche">{c.display_name}</h1>

          <p className="mt-4 text-lg">
            {c.category?.name}
            {c.is_group ? `, groupe de ${c.members_count}` : ""}
            {c.city ? `, ${c.city}` : ""}
          </p>

          {reponse.meta && c.votes_count > 0 ? (
            <p className="mt-1 text-sm text-discret">
              {reponse.meta.rank === 1
                ? "En tête de sa catégorie"
                : `${reponse.meta.rank}ᵉ de sa catégorie`}
            </p>
          ) : null}
        </header>

        <div className="lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <div className="relative aspect-4/5 overflow-hidden rounded-region border border-bordure bg-surface">
            {c.photo_url ? (
              <Image
                src={c.photo_url}
                alt={c.display_name}
                fill
                sizes="(max-width: 1024px) 100vw, 22rem"
                className="object-cover"
                priority
                unoptimized
              />
            ) : (
              <span className="flex h-full items-center justify-center text-sm text-discret">
                Sans photo
              </span>
            )}
          </div>

          {/* Bloc de vote : l'etat reel plutot qu'un bouton qui ne mene nulle
              part tant que les votes ne sont pas ouverts. */}
          <div className="mt-4 rounded-region border border-bordure bg-surface p-6">
            <p className="text-sm text-discret">Voix reçues</p>
            <p className="montant mt-1 text-4xl text-accent">{nombre(c.votes_count)}</p>

            {votesOuverts ? (
              <LienBouton
                href={`/candidats/${c.slug}/voter`}
                taille="grand"
                className="mt-6 w-full"
              >
                Voter pour {c.display_name}
              </LienBouton>
            ) : (
              <p className="mt-4 text-sm text-discret">
                Les votes ouvriront après les castings. Revenez à ce moment-là
                pour soutenir {c.is_group ? "ce groupe" : "ce candidat"}.
              </p>
            )}
          </div>
        </div>

        <div className="grid content-start gap-8 lg:col-start-2">
          {c.presentation ? (
            <section className="border-t border-bordure pt-8">
              <h2 className="text-xl">{c.is_group ? "Le groupe" : "Son parcours"}</h2>
              <p className="mt-2 max-w-2xl whitespace-pre-line">{c.presentation}</p>
            </section>
          ) : null}

          {c.is_group && c.members && c.members.length > 0 ? (
            <section className="border-t border-bordure pt-8">
              <h2 className="text-xl">La formation</h2>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {c.members.map((membre, i) => (
                  <li key={`${membre.full_name}-${i}`} className="flex items-center gap-3">
                    {membre.photo_url ? (
                      <Image
                        src={membre.photo_url}
                        alt=""
                        width={40}
                        height={40}
                        className="size-10 shrink-0 rounded-pilule border border-bordure object-cover"
                        unoptimized
                      />
                    ) : (
                      <span className="chiffre flex size-10 shrink-0 items-center justify-center rounded-pilule bg-appui text-sm text-discret">
                        {membre.full_name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 truncate" title={membre.full_name}>
                      {membre.full_name}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {reseaux.length > 0 ? (
            <section className="border-t border-bordure pt-8">
              <h2 className="text-xl">{c.is_group ? "Les suivre" : "Le suivre"}</h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {reseaux.map(([nom, url]) => (
                  <li key={nom}>
                    <a
                      href={url as string}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="appui inline-flex h-8 items-center gap-2 rounded-controle border border-bordure-forte px-3 text-sm text-fort capitalize hover:border-fort hover:bg-appui"
                    >
                      {nom}
                      <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3 fill-none stroke-current" strokeWidth="1.5">
                        <path d="M6 3h7v7M13 3 4 12" />
                      </svg>
                      <span className="sr-only">(nouvel onglet)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
