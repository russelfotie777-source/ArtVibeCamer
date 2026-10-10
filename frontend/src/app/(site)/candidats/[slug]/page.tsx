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
    <div className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
      <Link
        href="/candidats"
        className="text-sm text-ink-soft underline decoration-ink-line underline-offset-4 transition-colors hover:text-brass hover:decoration-brass"
      >
        Tous les candidats
      </Link>

      <div className="mt-8 grid gap-12 lg:grid-cols-[22rem_1fr]">
        <div>
          <div className="panneau relative aspect-4/5 overflow-hidden border border-ink-line bg-ink-raised">
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
              <span className="flex h-full items-center justify-center text-sm text-ink-soft">
                Sans photo
              </span>
            )}
          </div>

          {/* Bloc de vote : l'etat reel plutot qu'un bouton qui ne mene nulle
              part tant que les votes ne sont pas ouverts. */}
          <div className="panneau mt-6 border border-ink-line bg-ink-raised p-6">
            <p className="text-sm text-ink-soft">Voix reçues</p>
            <p className="montant mt-1 text-4xl text-brass">
              {nombre(c.votes_count)}
            </p>

            {votesOuverts ? (
              <LienBouton
                href={`/candidats/${c.slug}/voter`}
                taille="grand"
                className="mt-5 w-full"
              >
                Voter pour {c.display_name}
              </LienBouton>
            ) : (
              <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                Les votes du public ouvriront après les castings. Revenez à ce
                moment-là pour soutenir ce candidat.
              </p>
            )}
          </div>
        </div>

        <div>
          {c.candidate_number ? (
            <p className="chiffre text-sm text-brass">{c.candidate_number}</p>
          ) : null}

          <h1 className="mt-2 font-display text-display font-extrabold">
            {c.display_name}
          </h1>

          <p className="mt-3 text-lg text-ink-soft">
            {c.category?.name}
            {c.is_group ? ` — groupe de ${c.members_count}` : ""}
            {c.city ? `, ${c.city}` : ""}
          </p>

          {reponse.meta && c.votes_count > 0 ? (
            <p className="mt-2 text-sm text-ink-soft">
              {reponse.meta.rank === 1
                ? "En tête de sa catégorie"
                : `${reponse.meta.rank}ᵉ de sa catégorie`}
            </p>
          ) : null}

          {c.presentation ? (
            <div className="mt-10 border-t border-ink-line pt-8">
              <h2 className="font-display text-xl font-extrabold">
                {c.is_group ? "Le groupe" : "Son parcours"}
              </h2>
              <p className="prose-etroit mt-3 leading-relaxed whitespace-pre-line text-ink-soft">
                {c.presentation}
              </p>
            </div>
          ) : null}

          {c.is_group && c.members && c.members.length > 0 ? (
            <div className="mt-10 border-t border-ink-line pt-8">
              <h2 className="font-display text-xl font-extrabold">
                La formation
              </h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {c.members.map((membre, i) => (
                  <li
                    key={`${membre.full_name}-${i}`}
                    className="flex items-center gap-3"
                  >
                    {membre.photo_url ? (
                      <Image
                        src={membre.photo_url}
                        alt=""
                        width={40}
                        height={40}
                        className="controle size-10 shrink-0 border border-ink-line object-cover"
                        unoptimized
                      />
                    ) : (
                      <span className="controle chiffre flex size-10 shrink-0 items-center justify-center border border-ink-line text-xs text-ink-soft">
                        {i + 1}
                      </span>
                    )}
                    <span className="text-sm">{membre.full_name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {reseaux.length > 0 ? (
            <div className="mt-10 border-t border-ink-line pt-8">
              <h2 className="font-display text-xl font-extrabold">Le suivre</h2>
              <ul className="mt-4 flex flex-wrap gap-3">
                {reseaux.map(([nom, url]) => (
                  <li key={nom}>
                    <a
                      href={url as string}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="controle inline-block border border-ink-line px-4 py-2 text-sm capitalize transition-colors hover:border-brass hover:text-brass"
                    >
                      {nom}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
