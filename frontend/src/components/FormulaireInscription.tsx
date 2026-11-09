"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import {
  Champ,
  ChampFichier,
  Groupe,
  Liste,
  Saisie,
  Zone,
} from "@/components/ui/Champ";
import { BASE_PUBLIQUE } from "@/lib/config";
import { fcfa } from "@/lib/format";
import type { Categorie, ReponseInscription, TypeInscription } from "@/lib/types";

type Erreurs = Record<string, string[]>;
type Membre = { nom: string; photo: string | null };

const MEMBRES_PAR_DEFAUT = 3;

/*
 * Le formulaire est envoye directement du navigateur vers l'API, et non via
 * une Server Action. Deux raisons : l'API voit alors l'adresse reelle du
 * candidat, dont dependent ses plafonds anti-abus, et le navigateur construit
 * lui-meme le multipart des photos.
 */
export function FormulaireInscription({
  categories,
  slugInitial,
}: {
  categories: Categorie[];
  slugInitial?: string;
}) {
  const router = useRouter();

  const ouvertes = useMemo(
    () => categories.filter((c) => c.is_registration_open),
    [categories],
  );

  const [categorieId, setCategorieId] = useState<string>(() => {
    const choisie = slugInitial
      ? ouvertes.find((c) => c.slug === slugInitial)
      : undefined;
    return String(choisie?.id ?? ouvertes[0]?.id ?? "");
  });

  const [formule, setFormule] = useState<TypeInscription>("solo");
  const [membres, setMembres] = useState<Membre[]>(
    Array.from({ length: MEMBRES_PAR_DEFAUT }, () => ({ nom: "", photo: null })),
  );

  const [envoi, setEnvoi] = useState(false);
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [message, setMessage] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  const categorie = ouvertes.find((c) => String(c.id) === categorieId);

  // Une categorie sans tarif groupe ne se presente qu'en individuel.
  const enGroupe = formule === "group" && categorie?.allows_group === true;
  const montant = categorie
    ? enGroupe
      ? (categorie.group_fee ?? categorie.registration_fee)
      : categorie.registration_fee
    : null;

  const err = (nom: string) => erreurs[nom]?.[0];

  function changerCategorie(valeur: string) {
    setCategorieId(valeur);
    const suivante = ouvertes.find((c) => String(c.id) === valeur);
    if (!suivante?.allows_group) setFormule("solo");
  }

  function changerNombre(nombre: number) {
    setMembres((actuels) =>
      Array.from(
        { length: nombre },
        (_, i) => actuels[i] ?? { nom: "", photo: null },
      ),
    );
  }

  function majMembre(index: number, champ: keyof Membre, valeur: string | null) {
    setMembres((actuels) =>
      actuels.map((m, i) => (i === index ? { ...m, [champ]: valeur } : m)),
    );
  }

  async function envoyer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEnvoi(true);
    setErreurs({});
    setMessage(null);

    const donnees = new FormData(event.currentTarget);

    try {
      const reponse = await fetch(`${BASE_PUBLIQUE}/registrations`, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: donnees,
      });

      const charge = await reponse.json().catch(() => null);

      if (!reponse.ok) {
        if (reponse.status === 422) {
          setErreurs(charge?.errors ?? {});
          setMessage(
            charge?.errors
              ? "Corrigez les champs signalés ci-dessous."
              : (charge?.message ?? "L’inscription a été refusée."),
          );
        } else if (reponse.status === 429) {
          setMessage(
            "Trop de tentatives depuis cette connexion. Patientez quelques minutes avant de réessayer.",
          );
        } else {
          setMessage(
            charge?.message ??
              "L’inscription n’a pas pu être enregistrée. Réessayez dans un instant.",
          );
        }

        setEnvoi(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      const resultat = charge as ReponseInscription;

      /*
       * Les consignes de l'operateur (code USSD par exemple) ne sont
       * produites qu'ici, a la creation du paiement. On les depose pour
       * l'ecran de suivi, qui ne peut pas les redemander.
       */
      if (resultat.payment.instructions) {
        try {
          sessionStorage.setItem(
            `avc_consignes_${resultat.transaction.reference}`,
            resultat.payment.instructions,
          );
        } catch {
          /* Navigation privee : l'ecran de suivi affichera un texte generique. */
        }
      }

      if (resultat.payment.redirect_url) {
        window.location.href = resultat.payment.redirect_url;
        return;
      }

      router.push(`/paiement/${resultat.transaction.reference}`);
    } catch {
      setMessage(
        "Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.",
      );
      setEnvoi(false);
    }
  }

  if (ouvertes.length === 0) {
    return (
      <div className="max-w-xl rounded-region border border-bordure p-6">
        <h2 className="text-xl">Les inscriptions sont fermées</h2>
        <p className="mt-2 text-discret">
          Revenez à l’ouverture de la prochaine édition. En attendant,
          retrouvez les talents déjà validés.
        </p>
        <Link
          href="/candidats"
          className="mt-4 inline-block text-lien underline decoration-1 underline-offset-4"
        >
          Voir les candidats
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={envoyer}
      className="grid items-start gap-12 lg:grid-cols-[minmax(0,40rem)_minmax(0,20rem)] lg:gap-16"
    >
      <div className="grid gap-8">
        {message ? (
          <div
            role="alert"
            className="rounded-region border border-danger bg-danger-fond px-4 py-3"
          >
            <p className="text-sm font-semibold text-danger">{message}</p>
          </div>
        ) : null}

        <Groupe
          titre="Votre discipline"
          description="Les frais dépendent de la catégorie et de la formule choisie."
        >
          <Champ
            etiquette="Catégorie"
            pour="category_id"
            obligatoire
            erreur={err("category_id")}
          >
            <Liste
              id="category_id"
              name="category_id"
              value={categorieId}
              onChange={(e) => changerCategorie(e.target.value)}
              erreur={err("category_id")}
              required
            >
              {ouvertes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Liste>
          </Champ>

          {/*
            La formule est un choix de tarif : elle se presente comme deux
            options comparables, prix affiche, et non comme une case a cocher
            dont on decouvrirait le cout plus tard.
          */}
          <fieldset>
            <legend className="text-sm font-semibold text-fort">Formule</legend>

            <input type="hidden" name="registration_type" value={enGroupe ? "group" : "solo"} />

            <div className="mt-2 grid gap-4 sm:grid-cols-2">
              {(
                [
                  {
                    valeur: "solo" as const,
                    titre: "Individuel",
                    detail: "Vous vous présentez seul",
                    prix: categorie?.registration_fee ?? null,
                    possible: true,
                  },
                  {
                    valeur: "group" as const,
                    titre: "En groupe",
                    detail: categorie?.allows_group
                      ? `Jusqu’à ${categorie.max_group_members} membres`
                      : "Non proposé dans cette catégorie",
                    prix: categorie?.group_fee ?? null,
                    possible: categorie?.allows_group === true,
                  },
                ]
              ).map((option) => {
                const actif = (option.valeur === "group") === enGroupe;

                return (
                  <label
                    key={option.valeur}
                    className={`flex flex-col gap-1 rounded-controle border p-4 transition-colors ${
                      !option.possible
                        ? "cursor-not-allowed border-bordure bg-appui opacity-60"
                        : actif
                          ? "cursor-pointer border-fort bg-appui ring-1 ring-fort ring-inset"
                          : "cursor-pointer border-bordure-forte bg-surface hover:border-fort"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="formule"
                        value={option.valeur}
                        checked={actif}
                        disabled={!option.possible}
                        onChange={() => setFormule(option.valeur)}
                        className="size-4 accent-focus"
                      />
                      <span className="font-semibold text-fort">{option.titre}</span>
                    </span>
                    <span className="montant text-xl">
                      {option.prix !== null ? fcfa(option.prix) : "—"}
                    </span>
                    <span className="text-sm text-discret">{option.detail}</span>
                  </label>
                );
              })}
            </div>

            {err("registration_type") ? (
              <p className="mt-2 text-sm text-danger">
                {err("registration_type")}
              </p>
            ) : null}
          </fieldset>
        </Groupe>

        {/* --- Composition du groupe --------------------------------- */}
        {enGroupe && categorie ? (
          <Groupe
            titre="Votre groupe"
            description="La liste des membres sert au contrôle le jour du casting."
          >
            <Champ
              etiquette="Nom du groupe"
              pour="group_name"
              obligatoire
              erreur={err("group_name")}
              aide="C’est ce nom qui sera affiché au public."
            >
              <Saisie
                id="group_name"
                name="group_name"
                required
                erreur={err("group_name")}
              />
            </Champ>

            <Champ
              etiquette="Nombre de membres"
              pour="nb_membres"
              obligatoire
              erreur={err("members")}
            >
              <Liste
                id="nb_membres"
                value={membres.length}
                onChange={(e) => changerNombre(Number(e.target.value))}
                erreur={err("members")}
              >
                {Array.from(
                  { length: Math.max(0, categorie.max_group_members - 1) },
                  (_, i) => i + 2,
                ).map((n) => (
                  <option key={n} value={n}>
                    {n} membres
                  </option>
                ))}
              </Liste>
            </Champ>

            <div className="grid gap-4">
              {membres.map((membre, i) => (
                <div
                  key={i}
                  className="grid gap-2 border-t border-bordure pt-4 sm:grid-cols-[minmax(0,1fr)_13rem] sm:items-end sm:gap-4"
                >
                  <Champ
                    etiquette={`Membre ${i + 1}`}
                    pour={`membre-${i}`}
                    obligatoire
                    erreur={err(`members.${i}.full_name`)}
                  >
                    <Saisie
                      id={`membre-${i}`}
                      name={`members[${i}][full_name]`}
                      value={membre.nom}
                      onChange={(e) => majMembre(i, "nom", e.target.value)}
                      placeholder="Nom et prénom"
                      required
                      erreur={err(`members.${i}.full_name`)}
                    />
                  </Champ>

                  <ChampFichier
                    id={`membre-photo-${i}`}
                    name={`members[${i}][photo]`}
                    fichier={membre.photo}
                    onFichier={(nom) => majMembre(i, "photo", nom)}
                    libelle="Photo"
                    vide="Facultative"
                  />
                </div>
              ))}
            </div>
          </Groupe>
        ) : null}

        <Groupe
          titre={enGroupe ? "Responsable du groupe" : "Votre identité"}
          description={
            enGroupe
              ? "La personne que l’organisation contactera, et dont le numéro sera débité."
              : undefined
          }
        >
          <div className="grid gap-6 sm:grid-cols-2">
            <Champ
              etiquette="Prénom"
              pour="first_name"
              obligatoire
              erreur={err("first_name")}
            >
              <Saisie
                id="first_name"
                name="first_name"
                autoComplete="given-name"
                required
                erreur={err("first_name")}
              />
            </Champ>

            <Champ
              etiquette="Nom"
              pour="last_name"
              obligatoire
              erreur={err("last_name")}
            >
              <Saisie
                id="last_name"
                name="last_name"
                autoComplete="family-name"
                required
                erreur={err("last_name")}
              />
            </Champ>
          </div>

          {!enGroupe ? (
            <Champ
              etiquette="Nom de scène"
              pour="stage_name"
              erreur={err("stage_name")}
              aide="C’est ce nom qui sera affiché au public. Sans nom de scène, votre prénom et nom seront utilisés."
            >
              <Saisie
                id="stage_name"
                name="stage_name"
                erreur={err("stage_name")}
              />
            </Champ>
          ) : null}

          <div className="grid gap-6 sm:grid-cols-2">
            <Champ etiquette="Ville" pour="city" erreur={err("city")}>
              <Saisie
                id="city"
                name="city"
                autoComplete="address-level2"
                erreur={err("city")}
              />
            </Champ>

            {!enGroupe ? (
              <Champ
                etiquette="Date de naissance"
                pour="date_of_birth"
                erreur={err("date_of_birth")}
              >
                <Saisie
                  id="date_of_birth"
                  name="date_of_birth"
                  type="date"
                  erreur={err("date_of_birth")}
                />
              </Champ>
            ) : null}
          </div>
        </Groupe>

        <Groupe
          titre="Vous joindre"
          description="L’organisation utilise ces coordonnées pour vous confirmer l’inscription. Elles ne sont pas publiées."
        >
          <div className="grid gap-6 sm:grid-cols-2">
            <Champ
              etiquette="Téléphone"
              pour="phone"
              obligatoire
              erreur={err("phone")}
              aide="Un mobile camerounais, par exemple 671 23 45 67."
            >
              <Saisie
                id="phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="671 23 45 67"
                required
                erreur={err("phone")}
              />
            </Champ>

            <Champ
              etiquette="WhatsApp"
              pour="whatsapp"
              erreur={err("whatsapp")}
              aide="Si différent de votre téléphone."
            >
              <Saisie
                id="whatsapp"
                name="whatsapp"
                type="tel"
                inputMode="tel"
                erreur={err("whatsapp")}
              />
            </Champ>
          </div>

          <Champ
            etiquette="Email"
            pour="email"
            erreur={err("email")}
            aide="Si vous n’en avez pas, laissez vide : le téléphone suffit."
          >
            <Saisie
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              erreur={err("email")}
            />
          </Champ>
        </Groupe>

        <Groupe
          titre={enGroupe ? "Votre groupe en quelques mots" : "Votre travail"}
          description="Ce que le public verra sur votre page de candidat."
        >
          <Champ
            etiquette={enGroupe ? "Photo du groupe" : "Photo"}
            pour="photo"
            erreur={err("photo")}
            aide="JPG, PNG ou WebP, 4 Mo maximum."
          >
            <ChampFichier
              id="photo"
              name="photo"
              fichier={photo}
              onFichier={setPhoto}
            />
          </Champ>

          <Champ
            etiquette="Présentation"
            pour="presentation"
            erreur={err("presentation")}
            aide="Votre parcours, votre style, ce que vous venez défendre. 2000 caractères maximum."
          >
            <Zone
              id="presentation"
              name="presentation"
              maxLength={2000}
              rows={6}
              erreur={err("presentation")}
            />
          </Champ>

          <div className="grid gap-6 sm:grid-cols-2">
            <Champ
              etiquette="Facebook"
              pour="socials-facebook"
              erreur={err("socials.facebook")}
            >
              <Saisie
                id="socials-facebook"
                name="socials[facebook]"
                type="url"
                placeholder="https://facebook.com/..."
                erreur={err("socials.facebook")}
              />
            </Champ>

            <Champ
              etiquette="Instagram"
              pour="socials-instagram"
              erreur={err("socials.instagram")}
            >
              <Saisie
                id="socials-instagram"
                name="socials[instagram]"
                type="url"
                placeholder="https://instagram.com/..."
                erreur={err("socials.instagram")}
              />
            </Champ>

            <Champ
              etiquette="TikTok"
              pour="socials-tiktok"
              erreur={err("socials.tiktok")}
            >
              <Saisie
                id="socials-tiktok"
                name="socials[tiktok]"
                type="url"
                erreur={err("socials.tiktok")}
              />
            </Champ>

            <Champ
              etiquette="YouTube"
              pour="socials-youtube"
              erreur={err("socials.youtube")}
            >
              <Saisie
                id="socials-youtube"
                name="socials[youtube]"
                type="url"
                erreur={err("socials.youtube")}
              />
            </Champ>
          </div>
        </Groupe>

        <Groupe
          titre="Paiement des frais"
          description="Le numéro qui sera débité. La demande de paiement arrive dessus juste après l’envoi du formulaire."
        >
          <Champ
            etiquette="Numéro Mobile Money"
            pour="payer_phone"
            erreur={err("payer_phone")}
            aide="Laissez vide pour utiliser votre numéro de téléphone."
          >
            <Saisie
              id="payer_phone"
              name="payer_phone"
              type="tel"
              inputMode="tel"
              erreur={err("payer_phone")}
            />
          </Champ>

          <div>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-fort">
              <input
                type="checkbox"
                name="accepts_terms"
                value="1"
                required
                className="mt-0.5 size-4 shrink-0 accent-focus"
              />
              <span>
                J’accepte le règlement du concours et je confirme que les
                informations fournies sont exactes.
              </span>
            </label>
            {err("accepts_terms") ? (
              <p className="mt-2 text-sm text-danger">
                {err("accepts_terms")}
              </p>
            ) : null}
          </div>
        </Groupe>
      </div>

      {/* --- Recapitulatif : il suit le defilement, le montant reste sous les yeux. */}
      <aside className="lg:sticky lg:top-8">
        <div className="overflow-hidden rounded-region border border-bordure bg-surface">
          <h2 className="border-b border-bordure px-4 py-3 text-base">Votre inscription</h2>

          <dl className="divide-y divide-bordure text-sm">
            <div className="flex items-baseline justify-between gap-4 px-4 py-3">
              <dt className="text-discret">Catégorie</dt>
              <dd className="text-right text-fort">{categorie?.name ?? "—"}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 px-4 py-3">
              <dt className="text-discret">Formule</dt>
              <dd className="text-right text-fort">
                {enGroupe ? `Groupe de ${membres.length}` : "Individuel"}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 px-4 py-3">
              <dt className="text-discret">Frais</dt>
              <dd className="montant text-2xl">
                {montant !== null ? fcfa(montant) : "—"}
              </dd>
            </div>
          </dl>

          <div className="border-t border-bordure p-4">
            <Bouton
              type="submit"
              taille="grand"
              chargement={envoi}
              disabled={envoi || !categorie}
              className="w-full"
            >
              {envoi
                ? "Envoi…"
                : montant !== null
                  ? `Payer ${fcfa(montant)}`
                  : "Payer les frais"}
            </Bouton>

            <p className="mt-4 text-sm text-discret">
              La demande de paiement arrive sur votre téléphone. Votre dossier
              est enregistré dès l’envoi&nbsp;: si le paiement échoue, vous
              le relancerez sans ressaisir le formulaire.
            </p>
          </div>
        </div>
      </aside>
    </form>
  );
}
