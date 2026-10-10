import type { Metadata } from "next";
import Link from "next/link";
import { MarqueSeule } from "@/components/Marque";
import { VignetteCandidat } from "@/components/VignetteCandidat";
import { lirePublic } from "@/lib/api";
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
              {candidats.length > 0 ? (
                <Link href="/candidats" className={"avc-actionSecondaire"}>
                  Voir les candidats
                </Link>
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
