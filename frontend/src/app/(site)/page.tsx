import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { MarqueSeule } from "@/components/Marque";
import { LienBouton } from "@/components/ui/Bouton";
import { VignetteCandidat } from "@/components/VignetteCandidat";
import { lirePublic } from "@/lib/api";
import { dateLongue, fcfa, joursRestants } from "@/lib/format";
import type {
  Candidat,
  Categorie,
  Enveloppe,
  Page as PagePaginee,
  Reglages,
} from "@/lib/types";
import "./accueil.css";

export const metadata: Metadata = {
  title: "La scène des talents camerounais",
  description:
    "Danse, chant, comédie, Miss & Master : les disciplines d’ArtVibeCamer, leurs tarifs et l’inscription des candidats.",
};

async function donnees() {
  const [categories, reglages, candidats] = await Promise.allSettled([
    lirePublic<{ data: Categorie[] }>("/categories"),
    lirePublic<Enveloppe<Reglages>>("/settings"),
    lirePublic<PagePaginee<Candidat>>("/candidates?per_page=3"),
  ]);

  return {
    categories: categories.status === "fulfilled" ? categories.value.data : [],
    reglages: reglages.status === "fulfilled" ? reglages.value.data : null,
    candidats: candidats.status === "fulfilled" ? candidats.value.data : [],
    candidatsInjoignables: candidats.status === "rejected",
  };
}

/** Au-dela, le titre se poserait en plus de 1,2 s : les mots suivants arrivent ensemble. */
const MOTS_ECHELONNES = 12;

export default async function Accueil() {
  const { categories, reglages, candidats, candidatsInjoignables } =
    await donnees();

  const ouvertes = categories.filter((c) => c.is_registration_open);
  const votesOuverts = categories.some((c) => c.is_voting_open);

  const slogan =
    reglages?.event_tagline ??
    "La culture, les talents et l’art camerounais sur une seule scène.";

  // La cloture la plus tardive des categories ouvertes : c'est la date que
  // le public retient, meme si une categorie ferme plus tot.
  const cloture = ouvertes
    .map((c) => c.registration_closes_at)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);
  const jours = cloture ? joursRestants(cloture) : null;
  const tarifMinimum = ouvertes.length
    ? Math.min(...ouvertes.map((c) => c.registration_fee))
    : null;

  const castings = [
    { ville: "Douala", detail: reglages?.casting_douala },
    { ville: "Yaoundé", detail: reglages?.casting_yaounde },
  ].filter(
    (casting): casting is { ville: string; detail: string } =>
      Boolean(casting.detail),
  );

  const actionPrincipale =
    ouvertes.length > 0
      ? { href: "/inscription", libelle: "Inscrire mon talent" }
      : candidats.length > 0
        ? { href: "/candidats", libelle: "Voir les candidats" }
        : null;

  return (
    <>
      {/* --- Ouverture ---------------------------------------------------- */}
      <section className="avc-hero" aria-labelledby="titre-accueil">
        <div className="cadre avc-heroGrille">
          <div className="avc-heroCopie">
            <h1 id="titre-accueil" className="avc-titre">
              {slogan.split(/\s+/).map((mot, i) => (
                <Fragment key={i}>
                  <span className="avc-mot">
                    <span style={{ "--i": Math.min(i, MOTS_ECHELONNES) } as React.CSSProperties}>
                      {mot}
                    </span>
                  </span>{" "}
                </Fragment>
              ))}
            </h1>

            {categories.length > 0 ? (
              <p className="mt-6 max-w-xl text-lg text-texte">
                {categories.map((c) => c.name).join(", ")}. Votre inscription
                se fait en ligne et se règle par Mobile Money.
              </p>
            ) : null}

            {cloture || tarifMinimum !== null ? (
              <dl className="avc-faits">
                {cloture ? (
                  <div>
                    <dt>Inscriptions</dt>
                    <dd>
                      jusqu’au {dateLongue(cloture)}
                      {jours !== null && jours <= 30 ? (
                        <span className="text-discret">
                          , {jours > 1 ? `${jours} jours restants` : "dernier jour"}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                ) : null}
                {tarifMinimum !== null ? (
                  <div>
                    <dt>Frais</dt>
                    <dd>dès {fcfa(tarifMinimum)}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}

            <div className="mt-8 flex flex-wrap items-center gap-4">
              {actionPrincipale ? (
                <LienBouton href={actionPrincipale.href} taille="grand">
                  {actionPrincipale.libelle}
                </LienBouton>
              ) : null}
              {ouvertes.length > 0 && candidats.length > 0 ? (
                <LienBouton href="/candidats" ton="secondaire" taille="grand">
                  Voir les candidats
                </LienBouton>
              ) : null}
            </div>
          </div>

          <div className="avc-heroVisuel">
            <MarqueSeule hauteur={640} priorite className="avc-illustration" />
          </div>
        </div>
      </section>

      {/* --- Disciplines et tarifs : un tableau, pas des cartes ------------ */}
      {categories.length > 0 ? (
        <section className="border-t border-bordure" aria-labelledby="titre-disciplines">
          <div className="cadre py-16 md:py-24">
            <h2 id="titre-disciplines" className="text-5xl tracking-affiche">
              Les disciplines
            </h2>

            <table className="avc-disciplines">
              <thead>
                <tr>
                  <th scope="col">Discipline</th>
                  <th scope="col">Individuel</th>
                  <th scope="col">En groupe</th>
                  <th scope="col">
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <th scope="row">
                      <span className="block text-4xl font-semibold tracking-affiche text-fort">
                        {c.name}
                      </span>
                      {c.tagline ? (
                        <span className="mt-1 block text-base text-discret">
                          {c.tagline}
                        </span>
                      ) : null}
                    </th>
                    <td data-libelle="Individuel">
                      <span className="montant text-xl">{fcfa(c.registration_fee)}</span>
                    </td>
                    <td data-libelle="En groupe">
                      {c.allows_group && c.group_fee !== null ? (
                        <>
                          <span className="montant text-xl">{fcfa(c.group_fee)}</span>
                          <span className="block text-sm text-discret">
                            jusqu’à {c.max_group_members} membres
                          </span>
                        </>
                      ) : (
                        <span className="text-sm text-discret">Individuel seulement</span>
                      )}
                    </td>
                    <td>
                      {c.is_registration_open && !c.is_full ? (
                        <LienBouton
                          href={`/inscription?categorie=${c.slug}`}
                          aria-label={`S’inscrire en ${c.name}`}
                          ton="secondaire"
                        >
                          S’inscrire
                        </LienBouton>
                      ) : (
                        <span className="text-sm text-discret">
                          {c.is_full ? "Complet" : "Inscriptions closes"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* --- De vrais visages : la section disparait sans profil valide ---- */}
      {candidats.length > 0 ? (
        <section className="border-t border-bordure" aria-labelledby="titre-candidats">
          <div className="cadre py-16 md:py-24">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 id="titre-candidats" className="text-5xl tracking-affiche">
                Les candidats
              </h2>
              <Link
                href="/candidats"
                className="text-base text-lien underline decoration-1 underline-offset-4"
              >
                Voir tous les candidats
              </Link>
            </div>

            <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {candidats.map((candidat) => (
                <li key={candidat.id} className="min-w-0 overflow-hidden rounded-region border border-bordure">
                  <VignetteCandidat candidat={candidat} niveauTitre={3} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* --- Une sequence reelle : rien n'est publie avant paiement -------- */}
      <section className="terrain-clair" aria-labelledby="titre-parcours">
        <div className="cadre py-16 md:py-24">
          <h2 id="titre-parcours" className="text-5xl tracking-affiche">
            Comment s’inscrire
          </h2>

          <ol className="avc-piste">
            <li>
              <h3>Remplissez votre dossier</h3>
              <p>
                Choisissez votre discipline et la formule, en individuel ou en
                groupe. Comptez cinq minutes.
              </p>
            </li>
            <li>
              <h3>Validez sur votre téléphone</h3>
              <p>
                La demande de paiement arrive sur votre mobile. Confirmez-la
                avec votre code MTN Mobile Money ou Orange Money.
              </p>
            </li>
            <li>
              <h3>Recevez votre numéro</h3>
              <p>
                Le paiement confirmé, votre numéro de candidat est attribué et
                l’organisation examine votre dossier.
              </p>
            </li>
          </ol>
        </div>
      </section>

      {/* --- Rendez-vous et echeance : seulement des reglages renseignes --- */}
      <section aria-labelledby="titre-rendez-vous">
        <div className="cadre grid gap-12 py-16 md:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-24">
          <div>
            <h2 id="titre-rendez-vous" className="text-5xl tracking-affiche">
              {castings.length > 0 ? "Les castings" : "Le rendez-vous"}
            </h2>

            {castings.length > 0 ? (
              <dl className="mt-8 border-t border-bordure">
                {castings.map((casting) => (
                  <div
                    key={casting.ville}
                    className="grid gap-1 border-b border-bordure py-4 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-6"
                  >
                    <dt className="text-xl font-semibold text-fort">{casting.ville}</dt>
                    <dd className="text-base text-texte sm:pt-0.5">
                      {casting.detail.replace(/\s*—\s*/g, ", ")}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : reglages?.event_city ? (
              <p className="mt-6 text-lg">{reglages.event_city}</p>
            ) : null}

            {castings.length > 0 && !votesOuverts ? (
              <p className="mt-4 text-sm text-discret">
                Les votes du public ouvriront après les castings.
              </p>
            ) : null}
          </div>

          <aside className="flex flex-col items-start rounded-region bg-accent p-8 text-sur-accent">
            <p className="text-sm font-semibold">
              {ouvertes.length > 0
                ? "Inscriptions ouvertes"
                : candidats.length > 0
                  ? "Les talents sont en ligne"
                  : candidatsInjoignables
                    ? "Informations indisponibles"
                    : "Inscriptions fermées"}
            </p>
            <h2 className="mt-2 text-4xl tracking-affiche text-sur-accent">
              {ouvertes.length > 0 && cloture
                ? `Jusqu’au ${dateLongue(cloture, false)}`
                : ouvertes.length > 0
                  ? "Votre scène vous attend"
                  : candidats.length > 0
                    ? "Soutenez vos talents"
                    : "La scène se prépare"}
            </h2>
            <p className="mt-4 text-base">
              {ouvertes.length > 0
                ? "Votre dossier est enregistré dès l’envoi. Si le paiement échoue, relancez-le sans tout ressaisir."
                : candidats.length > 0
                  ? "Retrouvez les profils validés par l’organisation."
                  : candidatsInjoignables
                    ? "La liste des talents ne répond pas. Rechargez la page dans quelques minutes."
                    : "Les profils paraîtront ici dès leur validation par l’organisation."}
            </p>
            {actionPrincipale ? (
              <Link
                href={actionPrincipale.href}
                className="appui mt-8 inline-flex h-12 items-center rounded-controle bg-sur-accent px-6 text-base font-semibold text-accent-survol hover:bg-appui"
              >
                {actionPrincipale.libelle}
              </Link>
            ) : null}
          </aside>
        </div>
      </section>
    </>
  );
}
