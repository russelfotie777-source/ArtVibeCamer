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
        className="w-auto"
        style={{ height: hauteurTexte }}
      />
    </>
  );

  const classes = `flex items-center gap-3 ${className}`;

  if (href === null) {
    return (
      <span className={classes} style={{ height: hauteur }}>
        {contenu}
      </span>
    );
  }

  return (
    <Link href={href} className={classes} style={{ height: hauteur }}>
      {contenu}
    </Link>
  );
}

/**
 * Organisateur et sponsors.
 *
 * Posee sur fond clair, et non sur le vert du site : le logo de
 * l'organisateur comporte du lettrage noir qui disparaitrait sur fond sombre.
 * Un partenaire se montre dans ses couleurs d'origine, pas retouche.
 */
export function BandePartenaires() {
  return (
    <section className="border-t border-ink-line/60">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-[auto_1fr] sm:gap-16">
          <div>
            <h2 className="text-sm text-ink-soft">Un événement porté par</h2>
            {/*
              Tuile blanche : le logo de l'organisateur comporte du lettrage
              noir, illisible sur le vert. Un partenaire se montre dans ses
              couleurs d'origine, jamais retouche pour s'adapter au fond.
            */}
            <div className="controle mt-4 inline-flex items-center justify-center bg-paper-raised px-7 py-5">
              <Image
                src="/marque/organisateur.png"
                alt="SAM BIAI — La force de l'art"
                width={360}
                height={296}
                className="h-20 w-auto"
              />
            </div>
          </div>

          <div>
            <h2 className="text-sm text-ink-soft">Avec le soutien de</h2>
            <div className="mt-4 flex flex-wrap items-stretch gap-4">
              <div className="controle inline-flex items-center justify-center bg-paper-raised px-7 py-5">
                <Image
                  src="/marque/sponsor-zamara.png"
                  alt="Zamara"
                  width={420}
                  height={420}
                  className="controle h-20 w-auto"
                />
              </div>
            </div>
            <p className="mt-5 text-sm text-ink-soft">
              Vous souhaitez soutenir l&apos;événement&nbsp;? Écrivez à
              l&apos;organisation.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
