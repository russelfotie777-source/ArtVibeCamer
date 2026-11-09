import Image from "next/image";
import Link from "next/link";

/*
 * Identite de l'evenement.
 *
 * Le logotype d'origine est vert sombre : illisible sur le fond vert sombre du
 * site. Une variante claire du lettrage est donc derivee de l'original, en
 * conservant exactement la forme des lettres. L'illustration, elle, est
 * utilisee telle quelle : c'est elle qui porte la couleur de la marque.
 */

const MARQUE = { src: "/marque/evenement-marque.png", w: 554, h: 760 };
const TEXTE_CLAIR = { src: "/marque/evenement-texte-clair.png", w: 876, h: 97 };
const TEXTE_SOMBRE = { src: "/marque/evenement-texte.png", w: 876, h: 97 };

/** Illustration seule : carte du Cameroun et disciplines. */
export function MarqueSeule({
  hauteur,
  className = "",
  priorite = false,
}: {
  hauteur: number;
  className?: string;
  priorite?: boolean;
}) {
  return (
    <Image
      src={MARQUE.src}
      alt=""
      aria-hidden="true"
      width={Math.round((MARQUE.w / MARQUE.h) * hauteur)}
      height={hauteur}
      priority={priorite}
      className={className}
    />
  );
}

/**
 * Verrou horizontal : illustration + lettrage. Sert de lien vers l'accueil
 * partout ou il apparait.
 */
export function LogoEvenement({
  variante = "clair",
  hauteur = 40,
  href = "/",
  className = "",
  priorite = false,
}: {
  variante?: "clair" | "sombre";
  hauteur?: number;
  href?: string | null;
  className?: string;
  priorite?: boolean;
}) {
  const texte = variante === "clair" ? TEXTE_CLAIR : TEXTE_SOMBRE;
  const hauteurTexte = Math.round(hauteur * 0.34);

  const contenu = (
    <>
      <Image
        src={MARQUE.src}
        alt=""
        aria-hidden="true"
        width={Math.round((MARQUE.w / MARQUE.h) * hauteur)}
        height={hauteur}
        priority={priorite}
        className="h-full w-auto"
      />
      <Image
        src={texte.src}
        alt="ArtVibeCamer"
        width={Math.round((texte.w / texte.h) * hauteurTexte)}
        height={hauteurTexte}
        priority={priorite}
      />
    </>
  );

  const classes = `flex items-center gap-2 ${className}`;

  if (href === null) {
    return (
      <span className={classes} style={{ height: hauteur }}>
        {contenu}
      </span>
    );
  }

  return (
    <Link href={href} className={`${classes} rounded-controle`} style={{ height: hauteur }}>
      {contenu}
    </Link>
  );
}

/**
 * Organisateur et sponsors.
 *
 * Chaque logo est pose sur une plaque blanche, en clair comme en sombre : le
 * logo de l'organisateur comporte du lettrage noir qui disparaitrait sur le
 * vert. Un partenaire se montre dans ses couleurs d'origine, jamais retouche
 * pour s'adapter au fond.
 */
export function BandePartenaires({ telephone }: { telephone?: string | null }) {
  return (
    <section aria-label="Partenaires" className="border-t border-bordure">
      <div className="cadre flex flex-wrap items-start gap-x-16 gap-y-8 py-12">
        <figure>
          <figcaption className="text-sm text-discret">Organisé par</figcaption>
          <div className="mt-2 inline-flex h-24 items-center rounded-region bg-plaque px-6">
            <Image
              src="/marque/organisateur.png"
              alt="SAM BIAI — La force de l’art"
              width={360}
              height={296}
              className="h-16 w-auto"
            />
          </div>
        </figure>

        <figure>
          <figcaption className="text-sm text-discret">Avec le soutien de</figcaption>
          <div className="mt-2 inline-flex h-24 items-center rounded-region bg-plaque px-6">
            <Image
              src="/marque/sponsor-zamara.png"
              alt="Zamara"
              width={420}
              height={420}
              className="h-16 w-auto"
            />
          </div>
        </figure>

        {telephone ? (
          <p className="max-w-xs self-end text-sm text-discret">
            Pour soutenir l’événement, appelez l’organisation au{" "}
            <a
              href={`tel:${telephone.replace(/\s/g, "")}`}
              className="chiffre whitespace-nowrap text-texte underline decoration-bordure-forte underline-offset-4 transition-colors hover:text-lien hover:decoration-lien"
            >
              {telephone}
            </a>
            .
          </p>
        ) : null}
      </div>
    </section>
  );
}
