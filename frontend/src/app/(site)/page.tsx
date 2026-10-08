import type { Metadata } from "next";
import Link from "next/link";
import { MarqueSeule } from "@/components/Marque";
import { VignetteCandidat } from "@/components/VignetteCandidat";
import { lirePublic } from "@/lib/api";
import {fcfa, nombre } from "@/lib/format";
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
    "Découvrez les disciplines d'ArtVibeCamer et inscrivez votre talent selon le format proposé.",
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
    categoriesInjoignables: categories.status === "rejected",
    candidatsInjoignables: candidats.status === "rejected",
  };
}

export default async function Accueil() {
  const {
    categories,
    reglages,
    candidats,
    candidatsInjoignables,
  } = await donnees();

  const ouvertes = categories.some((categorie) => categorie.is_registration_open);

  const slogan =
    reglages?.event_tagline ??
    "La culture, les talents et l'art camerounais sur une seule scène.";
  const nomsDisciplines = categories.map((categorie) => categorie.name);
  const castings = [
    { ville: "Douala", detail: reglages?.casting_douala },
    { ville: "Yaoundé", detail: reglages?.casting_yaounde },
  ].filter(
    (casting): casting is { ville: string; detail: string } =>
      Boolean(casting.detail),
  );

  const hrefPrincipal = ouvertes ? "/inscription" : "/candidats";
  const libellePrincipal = ouvertes
    ? "Inscrire mon talent"
    : "Découvrir les candidats";
  const actionPrincipaleDisponible = ouvertes || candidats.length > 0;

  return (
    <div className={"avc-page"}>
      {/* Ouverture : la marque et les informations utiles, sans chiffres de vitrine. */}
      <section className={"avc-hero"} aria-labelledby="titre-accueil">
        <div className={"avc-heroInner"}>
          <div className={"avc-heroCopy"}>

            <h1 id="titre-accueil" className={"avc-heroTitle"}>
              {slogan}
            </h1>

            {nomsDisciplines.length > 0 ? (
              <p className={"avc-heroDisciplines"}>
                {nomsDisciplines.join(", ")}
              </p>
            ) : null}

            <p className={"avc-heroIntro"}>
              Choisissez votre discipline et le format disponible, puis
              validez votre inscription depuis votre téléphone.
            </p>

            <div className={"avc-heroActions"}>
              {actionPrincipaleDisponible ? (
                <Link href={hrefPrincipal} className={"avc-actionPrincipale"}>
                  {libellePrincipal}
                </Link>
              ) : null}
              {categories.length > 0 ? (
                <a href="#disciplines" className={"avc-actionSecondaire"}>
                  Voir les disciplines
                </a>
              ) : null}
            </div>

          </div>

          <div className={"avc-heroVisual"}>
            <div className={"avc-illustrationCadre"}>
              <MarqueSeule
                hauteur={760}
                priorite
                className={"avc-illustration"}
              />
            </div>

          </div>
        </div>

      </section>


      {/* Disciplines : tarifs et états viennent toujours de l'API. */}
      {categories.length > 0 ? (
        <section
          id="disciplines"
          className={"avc-disciplines"}
          aria-labelledby="titre-disciplines"
        >
          <div className={"avc-conteneurClair"}>
            <header className={"avc-enteteSection"}>
              <div>
                <h2 id="titre-disciplines">Choisissez votre discipline.</h2>
              </div>
              <p>
                Consultez les formats proposés et les frais d&apos;inscription
                propres à chaque discipline.
              </p>
            </header>

            {/*
              Liste editoriale, pas une grille de fiches. Quatre rectangles
              identiques bordes font un catalogue de produits ; un filet franc
              et de l'air laissent chaque discipline exister pour elle-meme.
            */}
            <ul className={"avc-listeDisciplines"}>
              {categories.map((categorie) => {
                const complet = categorie.is_full;
                const ouverte = categorie.is_registration_open && !complet;

                return (
                  <li key={categorie.id}>
                    <article className={"avc-discipline"}>
                      <h3>{categorie.name}</h3>

                      {categorie.tagline ? (
                        <p className={"avc-accrocheDiscipline"}>
                          {categorie.tagline}
                        </p>
                      ) : null}

                      {categorie.description ? (
                        <p className={"avc-descriptionDiscipline"}>
                          {categorie.description}
                        </p>
                      ) : null}

                      {/*
                        Les tarifs se lisent comme une phrase. « Individuel …
                        8 000 FCFA » sur deux colonnes, c'est une grille de
                        prix ; ici quelqu'un parle.
                      */}
                      <p className={"avc-tarifDiscipline"}>
                        <strong>{fcfa(categorie.registration_fee)}</strong>
                        {categorie.group_fee !== null ? " en individuel" : ""}
                        {categorie.group_fee !== null ? (
                          <>
                            <br />
                            <strong>{fcfa(categorie.group_fee)}</strong> en
                            groupe
                          </>
                        ) : null}
                      </p>

                      {/*
                        On ne signale que l'exception. « Ouvert » repete sur
                        les quatre disciplines n'apprend rien : c'est l'etat
                        normal, et le bouton le dit deja.
                      */}
                      <p className={"avc-piedDiscipline"}>
                        {complet
                          ? "Complet"
                          : !categorie.is_registration_open
                            ? "Inscriptions fermées"
                            : categorie.candidates_count > 0
                              ? `${nombre(categorie.candidates_count)} candidat${
                                  categorie.candidates_count > 1 ? "s" : ""
                                } déjà inscrit${
                                  categorie.candidates_count > 1 ? "s" : ""
                                }`
                              : "Personne ne s'est encore présenté"}
                      </p>

                      {ouverte ? (
                        <Link
                          href={`/inscription?categorie=${categorie.slug}`}
                          aria-label={`S'inscrire en ${categorie.name}`}
                          className={"avc-boutonDiscipline"}
                        >
                          S&apos;inscrire
                        </Link>
                      ) : null}
                    </article>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ) : null}

      {/* De vrais visages uniquement : la section disparaît si aucun profil validé. */}
      {candidats.length > 0 ? (
        <section className={"avc-candidats"} aria-labelledby="titre-candidats">
          <div className={"avc-conteneurSombre"}>
            <header className={"avc-enteteCandidats"}>
              <div>
                <h2 id="titre-candidats">
                  Celles et ceux qui ont déjà franchi le pas.
                </h2>
              </div>
              <Link href="/candidats" className={"avc-lienToutVoir"}>
                Voir tous les candidats
              </Link>
            </header>

            <ul className={"avc-grilleCandidats"}>
              {candidats.map((candidat) => (
                <li key={candidat.id}>
                  <VignetteCandidat candidat={candidat} niveauTitre={3} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* Une séquence réelle : aucun dossier n'est publié avant paiement et validation. */}
      <section className={"avc-parcours"} aria-labelledby="titre-parcours">
        <div className={"avc-conteneurClair"}>
          <header className={"avc-enteteParcours"}>
            <h2 id="titre-parcours">Comment se déroule une inscription.</h2>
          </header>

          <ol className={"avc-etapes"}>
            {[
              {
                titre: "Présentez votre talent",
                texte:
                  "Choisissez votre discipline et renseignez votre dossier, en individuel ou en groupe.",
              },
              {
                titre: "Validez sur votre téléphone",
                texte:
                  "La demande de paiement arrive sur votre mobile. Confirmez-la avec votre code Mobile Money.",
              },
              {
                titre: "Recevez votre numéro",
                texte:
                  "Après confirmation du paiement, votre numéro de candidat est attribué et l'organisation examine votre dossier.",
              },
            ].map((etape, index) => (
              <li key={etape.titre}>
                <span className={"avc-numeroEtape"} aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3>{etape.titre}</h3>
                  <p>{etape.texte}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Rendez-vous et dernier appel : seulement des informations configurées. */}
      <section className={"avc-cloture"} aria-labelledby="titre-cloture">
        <div className={"avc-clotureInterieur"}>
          <div className={"avc-rendezVous"}>
            <h2 id="titre-cloture">
              {castings.length > 0 ? "Les rendez-vous annoncés." : slogan}
            </h2>

            {castings.length > 0 ? (
              <>
                <p className={"avc-introCastings"}>
                  Les votes du public ouvriront après les castings.
                </p>
                <dl className={"avc-listeCastings"}>
                  {castings.map((casting) => (
                    <div key={casting.ville}>
                      <dt>{casting.ville}</dt>
                      <dd>{casting.detail.replace(/\s*\u2014\s*/g, ", ")}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : reglages?.event_city ? (
              <p className={"avc-introCastings"}>{reglages.event_city}</p>
            ) : null}
          </div>

          <aside className={"avc-appelFinal"}>
            <p className={"avc-appelEtiquette"}>
              {ouvertes
                ? "Les inscriptions sont ouvertes"
                : candidats.length > 0
                  ? "Les talents sont en ligne"
                  : candidatsInjoignables
                    ? "Informations momentanément indisponibles"
                    : "Les candidatures se préparent"}
            </p>
            <h2>
              {ouvertes
                ? "Votre inscription commence ici."
                : candidats.length > 0
                  ? "Découvrez les talents."
                  : "La scène se prépare."}
            </h2>
            <p>
              {ouvertes
                ? "Choisissez votre discipline. Le formulaire recueille votre candidature et le paiement se valide depuis votre téléphone."
                : candidats.length > 0
                  ? "Retrouvez les profils validés par l'organisation et suivez la suite du concours."
                  : candidatsInjoignables
                    ? "La liste des talents n'est pas joignable pour le moment. Revenez bientôt."
                    : "Les profils apparaîtront ici dès leur validation par l'organisation."}
            </p>
            {actionPrincipaleDisponible ? (
              <Link href={hrefPrincipal} className={"avc-actionFinale"}>
                {libellePrincipal}
              </Link>
            ) : null}
          </aside>
        </div>
      </section>
    </div>
  );
}
