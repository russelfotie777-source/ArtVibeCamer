import { LienBouton } from "@/components/ui/Bouton";
import { lirePublic } from "@/lib/api";
import { dateCourte, fcfa, nombre } from "@/lib/format";
import type { Categorie, Enveloppe, Reglages } from "@/lib/types";

async function donnees() {
  try {
    const [categories, reglages] = await Promise.all([
      lirePublic<{ data: Categorie[] }>("/categories"),
      lirePublic<Enveloppe<Reglages>>("/settings"),
    ]);
    return { categories: categories.data, reglages: reglages.data, erreur: false };
  } catch {
    return { categories: [], reglages: null, erreur: true };
  }
}

export default async function Accueil() {
  const { categories, reglages, erreur } = await donnees();

  const ouvertes = categories.some((c) => c.is_registration_open);
  const fraisMin = categories.length ? Math.min(...categories.map((c) => c.registration_fee)) : 0;
  const fraisMax = categories.length ? Math.max(...categories.map((c) => c.registration_fee)) : 0;
  const echeance = categories
    .map((c) => c.registration_closes_at)
    .filter((d): d is string => Boolean(d))
    .sort()[0];

  return (
    <>
      {/* --- Ouverture ------------------------------------------------- */}
      <section className="mx-auto w-full max-w-6xl px-5 pt-10 pb-20 sm:px-8 sm:pt-16">
        <div className="grid gap-12 lg:grid-cols-[1.6fr_1fr] lg:items-end lg:gap-16">
          <div>
            <h1 className="font-display text-[length:var(--text-display-lg)] font-extrabold">
              Huit disciplines,
              <br />
              une scène,
              <br />
              le vote du public.
            </h1>

            <p className="prose-etroit mt-8 text-lg text-ink-soft">
              {reglages?.event_tagline ??
                "ArtVibeCamer met en avant la culture, les talents et l'art camerounais."}{" "}
              Choisissez votre discipline, inscrivez-vous en ligne, et laissez
              le public décider.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <LienBouton href="/inscription" taille="grand">
                Inscrire mon talent
              </LienBouton>
              {categories.length > 0 ? (
                <a
                  href="#disciplines"
                  className="text-sm text-ink-soft underline decoration-ink-line underline-offset-4 transition-colors hover:text-brass hover:decoration-brass"
                >
                  Voir les {categories.length} disciplines
                </a>
              ) : null}
            </div>
          </div>

          {/*
            Le bloc de droite porte une information fonctionnelle — l'etat reel
            des inscriptions — et non des chiffres de vitrine.
          */}
          <aside className="panneau border border-ink-line bg-ink-raised p-7">
            {erreur ? (
              <>
                <p className="font-display text-xl font-extrabold text-brass">
                  Site en cours de préparation
                </p>
                <p className="mt-3 text-sm text-ink-soft">
                  Les inscriptions ne sont pas encore joignables. Revenez dans
                  un moment.
                </p>
              </>
            ) : (
              <>
                <p className="font-display text-2xl font-extrabold">
                  {ouvertes ? "Inscriptions ouvertes" : "Inscriptions fermées"}
                </p>

                <dl className="mt-6 space-y-4 border-t border-ink-line pt-6 text-sm">
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-ink-soft">Frais</dt>
                    <dd className="montant text-lg text-brass">
                      {fraisMin === fraisMax
                        ? fcfa(fraisMin)
                        : `${nombre(fraisMin)} à ${fcfa(fraisMax)}`}
                    </dd>
                  </div>

                  {echeance ? (
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="text-ink-soft">Clôture</dt>
                      <dd>{dateCourte(echeance)}</dd>
                    </div>
                  ) : null}

                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-ink-soft">Paiement</dt>
                    <dd className="text-right">MTN MoMo, Orange Money</dd>
                  </div>
                </dl>

                {!ouvertes && categories.length > 0 ? (
                  <p className="mt-6 text-sm text-ink-soft">
                    Les candidatures sont closes pour le moment. Suivez la page
                    pour la prochaine édition.
                  </p>
                ) : null}
              </>
            )}
          </aside>
        </div>
      </section>

      {/* --- Disciplines ----------------------------------------------- */}
      {categories.length > 0 ? (
        <section id="disciplines" className="bg-paper text-ink">
          <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="font-display text-[length:var(--text-display)] font-extrabold">
                Choisissez votre discipline
              </h2>
              <p className="prose-etroit text-sm text-paper-soft">
                Les frais varient selon les exigences techniques de la
                discipline. Ils couvrent votre participation au concours.
              </p>
            </div>

            {/*
              Grille a filets plutot que cartes a ombre : la structure vient
              des separations, pas d'un empilement de boites identiques.
            */}
            <ul className="mt-12 grid gap-px border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4">
              {categories.map((c) => (
                <li key={c.id} className="bg-paper-raised">
                  <article className="flex h-full flex-col justify-between gap-6 p-6">
                    <div>
                      <h3 className="font-display text-xl font-extrabold">
                        {c.name}
                      </h3>
                      {c.description ? (
                        <p className="mt-2 text-sm leading-relaxed text-paper-soft">
                          {c.description}
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <p className="montant text-2xl">
                        {fcfa(c.registration_fee)}
                      </p>
                      <p className="mt-2 text-xs text-paper-soft">
                        {c.candidates_count === 0
                          ? "Aucun candidat inscrit"
                          : `${nombre(c.candidates_count)} candidat${c.candidates_count > 1 ? "s" : ""} inscrit${c.candidates_count > 1 ? "s" : ""}`}
                        {c.is_full
                          ? " · complet"
                          : c.is_registration_open
                            ? ""
                            : " · inscriptions fermées"}
                      </p>

                      {c.is_registration_open ? (
                        <LienBouton
                          href={`/inscription?categorie=${c.slug}`}
                          ton="contour"
                          taille="petit"
                          className="mt-4"
                        >
                          S&apos;inscrire en {c.name.toLowerCase()}
                        </LienBouton>
                      ) : null}
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* --- Deroulement : vraie sequence, donc numerotee --------------- */}
      <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
        <h2 className="font-display text-[length:var(--text-display)] font-extrabold">
          Comment se déroule une inscription
        </h2>

        <ol className="mt-12 grid gap-10 sm:grid-cols-3">
          {[
            {
              titre: "Vous remplissez le formulaire",
              texte:
                "Vos coordonnées, votre photo et une présentation de votre travail. Comptez cinq minutes.",
            },
            {
              titre: "Vous payez les frais",
              texte:
                "Une demande de paiement arrive sur votre téléphone. Vous validez avec votre code Mobile Money.",
            },
            {
              titre: "L'organisation valide",
              texte:
                "Votre dossier est vérifié, votre numéro de candidat vous est attribué, et votre page devient visible.",
            },
          ].map((etape, i) => (
            <li key={etape.titre} className="border-t border-ink-line pt-6">
              <span
                className="montant block text-3xl text-brass"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <h3 className="mt-3 font-display text-lg font-extrabold">
                {etape.titre}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {etape.texte}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
