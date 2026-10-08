import Image from "next/image";
import Link from "next/link";
import { nombre } from "@/lib/format";
import type { Candidat } from "@/lib/types";

/**
 * Vignette d'un candidat dans la liste publique.
 *
 * Le numero passe avant le nom : c'est lui qui sert a voter, et c'est sous ce
 * numero que le public le retrouvera le soir du spectacle.
 */
export function VignetteCandidat({
  candidat,
  niveauTitre = 2,
}: {
  candidat: Candidat;
  niveauTitre?: 2 | 3;
}) {
  const Titre = niveauTitre === 3 ? "h3" : "h2";

  return (
    <Link
      href={`/candidats/${candidat.slug}`}
      className="group flex h-full flex-col transition-colors hover:bg-ink-raised"
    >
      <div className="relative aspect-4/5 overflow-hidden bg-ink-raised">
        {candidat.photo_url ? (
          <Image
            src={candidat.photo_url}
            alt={candidat.display_name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover"
            unoptimized
          />
        ) : (
          <span className="flex h-full items-center justify-center text-sm text-ink-soft">
            Sans photo
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between gap-3 p-5">
        <div>
          {candidat.candidate_number ? (
            <p className="chiffre text-sm text-brass">
              {candidat.candidate_number}
            </p>
          ) : null}
          <Titre className="mt-1 font-display text-lg font-extrabold group-hover:text-brass">
            {candidat.display_name}
          </Titre>
          <p className="mt-1 text-sm text-ink-soft">
            {candidat.category?.name}
            {candidat.is_group ? `, groupe de ${candidat.members_count}` : ""}
          </p>
        </div>

        {candidat.votes_count > 0 ? (
          <p className="text-sm text-ink-soft">
            <span className="chiffre text-paper">
              {nombre(candidat.votes_count)}
            </span>{" "}
            voix
          </p>
        ) : null}
      </div>
    </Link>
  );
}
