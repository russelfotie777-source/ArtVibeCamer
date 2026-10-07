"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Champ, Groupe, Liste, Saisie, Zone } from "@/components/ui/Champ";
import { BASE_PUBLIQUE } from "@/lib/config";
import { fcfa } from "@/lib/format";
import type { Categorie, ReponseInscription } from "@/lib/types";

type Erreurs = Record<string, string[]>;

/*
 * Le formulaire est envoye directement du navigateur vers l'API, et non via
 * une Server Action. Deux raisons : l'API voit alors l'adresse reelle du
 * candidat, dont dependent ses plafonds anti-abus, et le navigateur construit
 * lui-meme le multipart de la photo.
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

  const [envoi, setEnvoi] = useState(false);
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [message, setMessage] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  const categorie = ouvertes.find((c) => String(c.id) === categorieId);
  const err = (nom: string) => erreurs[nom]?.[0];

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
              ? "Quelques champs demandent une correction."
              : (charge?.message ?? "L'inscription a été refusée."),
          );
        } else if (reponse.status === 429) {
          setMessage(
            "Trop de tentatives depuis cette connexion. Patientez quelques minutes avant de réessayer.",
          );
        } else {
          setMessage(
            charge?.message ??
              "L'inscription n'a pas pu être enregistrée. Réessayez dans un instant.",
          );
        }

        setEnvoi(false);
        // Ramene le candidat sur le premier message d'erreur.
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

      // Le paiement se poursuit sur son propre ecran, qui suit la transaction.
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
      <div className="panneau border border-rule bg-paper-raised p-8">
        <h2 className="font-display text-xl font-extrabold">
          Les inscriptions sont fermées
        </h2>
        <p className="prose-etroit mt-2 text-paper-soft">
          Aucune catégorie n&apos;accepte de candidature pour le moment.
          Revenez à l&apos;ouverture de la prochaine édition.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={envoyer} className="grid gap-12 lg:grid-cols-[1fr_20rem]">
      <div className="grid gap-9">
        {message ? (
          <div
            role="alert"
            className="panneau border-l-2 border-oxblood bg-oxblood-wash px-5 py-4"
          >
            <p className="text-sm font-medium text-oxblood">{message}</p>
          </div>
        ) : null}

        <Groupe
          titre="Votre discipline"
          description="Les frais d'inscription dépendent de la catégorie choisie."
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
              onChange={(e) => setCategorieId(e.target.value)}
              erreur={err("category_id")}
              required
            >
              {ouvertes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {fcfa(c.registration_fee)}
                </option>
              ))}
            </Liste>
          </Champ>
        </Groupe>

        <Groupe titre="Votre identité">
          <div className="grid gap-5 sm:grid-cols-2">
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

          <Champ
            etiquette="Nom de scène"
            pour="stage_name"
            erreur={err("stage_name")}
            aide="C'est ce nom qui sera affiché au public. Sans nom de scène, votre prénom et nom seront utilisés."
          >
            <Saisie
              id="stage_name"
              name="stage_name"
              erreur={err("stage_name")}
            />
          </Champ>

          <div className="grid gap-5 sm:grid-cols-2">
            <Champ etiquette="Ville" pour="city" erreur={err("city")}>
              <Saisie
                id="city"
                name="city"
                autoComplete="address-level2"
                erreur={err("city")}
              />
            </Champ>

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
          </div>
        </Groupe>

        <Groupe
          titre="Vous joindre"
          description="L'organisation utilise ces coordonnées pour vous confirmer votre inscription. Elles ne sont pas publiées."
        >
          <div className="grid gap-5 sm:grid-cols-2">
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
            obligatoire
            erreur={err("email")}
          >
            <Saisie
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              erreur={err("email")}
            />
          </Champ>
        </Groupe>

        <Groupe
          titre="Votre travail"
          description="Ce que le public verra sur votre page de candidat."
        >
          <Champ
            etiquette="Photo"
            pour="photo"
            erreur={err("photo")}
            aide="JPG, PNG ou WebP, 4 Mo maximum. Un portrait net est préférable."
          >
            <div className="controle flex items-center gap-3 border border-rule bg-paper-raised p-1.5">
              <label
                htmlFor="photo"
                className="controle cursor-pointer border border-ink/20 bg-paper px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors hover:border-ink hover:bg-ink/5"
              >
                Choisir une photo
              </label>
              <span className="min-w-0 truncate text-sm text-paper-soft">
                {photo ?? "Aucune photo choisie"}
              </span>
              <input
                id="photo"
                name="photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setPhoto(e.target.files?.[0]?.name ?? null)}
                className="sr-only"
              />
            </div>
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

          <div className="grid gap-5 sm:grid-cols-2">
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
          description="Le numéro qui sera débité. La demande de paiement arrive dessus juste après l'envoi du formulaire."
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
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                name="accepts_terms"
                value="1"
                required
                className="controle mt-0.5 size-4 shrink-0 border-rule accent-brass"
              />
              <span>
                J&apos;accepte le règlement du concours et je confirme que les
                informations fournies sont exactes.
              </span>
            </label>
            {err("accepts_terms") ? (
              <p className="mt-1.5 text-sm text-oxblood">
                {err("accepts_terms")}
              </p>
            ) : null}
          </div>
        </Groupe>
      </div>

      {/* --- Recapitulatif ------------------------------------------- */}
      <aside className="lg:sticky lg:top-8 lg:h-fit">
        <div className="panneau border border-rule bg-paper-raised">
          <div className="border-b border-rule px-6 py-5">
            <h2 className="font-display text-lg font-extrabold">
              Votre inscription
            </h2>
          </div>

          <dl className="divide-y divide-rule">
            <div className="flex items-baseline justify-between gap-4 px-6 py-4">
              <dt className="text-sm text-paper-soft">Catégorie</dt>
              <dd className="text-right text-sm font-medium">
                {categorie?.name ?? "—"}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 px-6 py-4">
              <dt className="text-sm text-paper-soft">Frais</dt>
              <dd className="montant text-xl">
                {categorie ? fcfa(categorie.registration_fee) : "—"}
              </dd>
            </div>
          </dl>

          <div className="border-t border-rule px-6 py-5">
            <Bouton
              type="submit"
              taille="grand"
              disabled={envoi || !categorie}
              className="w-full"
            >
              {envoi
                ? "Envoi en cours"
                : categorie
                  ? `Payer ${fcfa(categorie.registration_fee)}`
                  : "Payer les frais"}
            </Bouton>

            <p className="mt-3 text-xs leading-relaxed text-paper-soft">
              Vous recevrez une demande de paiement sur votre téléphone. Votre
              inscription est enregistrée dès maintenant : si le paiement
              échoue, vous pourrez le relancer sans ressaisir le formulaire.
            </p>
          </div>
        </div>
      </aside>
    </form>
  );
}
