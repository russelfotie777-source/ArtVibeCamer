"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Champ, Saisie } from "@/components/ui/Champ";
import { BASE_PUBLIQUE } from "@/lib/config";
import { fcfa, nombre } from "@/lib/format";
import type { Candidat, ReponseVote } from "@/lib/types";

type Erreurs = Record<string, string[]>;

/*
 * Quantites proposees d'un geste. Le champ libre reste disponible en dessous :
 * ces paliers ne sont la que pour eviter cinq appuis sur un telephone, pas
 * pour contraindre le votant.
 */
const PALIERS = [1, 5, 10, 25, 50, 100];

/*
 * Comme le formulaire d'inscription, l'envoi part directement du navigateur
 * vers l'API : celle-ci voit ainsi l'adresse reelle du votant, dont dependent
 * les plafonds qui protegent le scrutin d'un bourrage automatise.
 */
export function FormulaireVote({ candidat }: { candidat: Candidat }) {
  const router = useRouter();

  const prix = candidat.category?.vote_price ?? 0;

  const [quantite, setQuantite] = useState(1);
  const [telephone, setTelephone] = useState("");
  const [nom, setNom] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [message, setMessage] = useState<string | null>(null);

  const total = prix * (Number.isFinite(quantite) ? Math.max(quantite, 0) : 0);

  async function envoyer(evenement: React.FormEvent) {
    evenement.preventDefault();

    setEnvoi(true);
    setErreurs({});
    setMessage(null);

    try {
      const reponse = await fetch(
        `${BASE_PUBLIQUE}/candidates/${encodeURIComponent(candidat.slug)}/votes`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          /*
           * Le montant n'est jamais envoye : seule la quantite voyage, et le
           * prix est repris de la categorie cote serveur. Un total calcule ici
           * n'est qu'un affichage.
           */
          body: JSON.stringify({
            quantity: quantite,
            voter_phone: telephone,
            voter_name: nom || null,
          }),
        },
      );

      const charge = await reponse.json().catch(() => null);

      if (!reponse.ok) {
        if (reponse.status === 422) {
          setErreurs(charge?.errors ?? {});
          setMessage(
            charge?.errors
              ? "Vérifiez la quantité et le numéro saisis."
              : (charge?.message ?? "Le vote a été refusé."),
          );
        } else if (reponse.status === 429) {
          setMessage(
            "Trop de tentatives depuis cette connexion. Patientez quelques minutes avant de réessayer.",
          );
        } else if (reponse.status === 403) {
          setMessage(
            charge?.message ?? "Les votes ne sont pas ouverts pour le moment.",
          );
        } else {
          setMessage(
            charge?.message ??
              "Le vote n'a pas pu être enregistré. Réessayez dans un instant.",
          );
        }

        setEnvoi(false);
        return;
      }

      const resultat = charge as ReponseVote;

      /*
       * Les consignes de l'operateur ne sont produites qu'ici, a la creation
       * du paiement. On les depose pour l'ecran de suivi, qui ne peut pas les
       * redemander.
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

  return (
    <form onSubmit={envoyer} className="grid gap-8">
      {message ? (
        <div
          role="alert"
          className="panneau border-l-2 border-oxblood bg-oxblood-wash px-5 py-4"
        >
          <p className="text-sm font-medium text-oxblood">{message}</p>
        </div>
      ) : null}

      <fieldset className="grid gap-3">
        <legend className="text-sm font-medium">Combien de voix ?</legend>

        <div className="flex flex-wrap gap-2">
          {PALIERS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setQuantite(n)}
              aria-pressed={quantite === n}
              className={`border px-4 py-2 text-sm transition-colors ${
                quantite === n
                  ? "border-laiton bg-laiton text-ink"
                  : "border-rule hover:border-ink"
              }`}
            >
              {nombre(n)}
            </button>
          ))}
        </div>

        <Champ
          etiquette="Ou saisissez un nombre"
          pour="quantity"
          erreur={erreurs.quantity?.[0]}
          aide={`${fcfa(prix)} la voix`}
          obligatoire
        >
          <Saisie
            id="quantity"
            name="quantity"
            type="number"
            inputMode="numeric"
            min={1}
            max={1000}
            value={Number.isFinite(quantite) ? quantite : ""}
            onChange={(e) => setQuantite(Number.parseInt(e.target.value, 10))}
          />
        </Champ>
      </fieldset>

      <Champ
        etiquette="Votre numéro Mobile Money"
        pour="voter_phone"
        erreur={erreurs.voter_phone?.[0]}
        aide="MTN ou Orange. C'est sur ce numéro que la demande de paiement arrivera."
        obligatoire
      >
        <Saisie
          id="voter_phone"
          name="voter_phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="6XX XX XX XX"
          value={telephone}
          onChange={(e) => setTelephone(e.target.value)}
        />
      </Champ>

      <Champ
        etiquette="Votre nom"
        pour="voter_name"
        erreur={erreurs.voter_name?.[0]}
        aide="Facultatif. Il n'est jamais affiché publiquement."
      >
        <Saisie
          id="voter_name"
          name="voter_name"
          autoComplete="name"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
        />
      </Champ>

      <div className="panneau border border-rule bg-paper-raised px-5 py-4">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm text-paper-soft">À payer</span>
          <span className="montant font-display text-2xl font-extrabold">
            {fcfa(total)}
          </span>
        </div>
        <p className="prose-etroit mt-2 text-xs text-paper-soft">
          Les voix ne sont comptabilisées qu&apos;une fois le paiement validé
          sur votre téléphone. Rien n&apos;est débité avant.
        </p>
      </div>

      <Bouton type="submit" taille="grand" disabled={envoi}>
        {envoi ? "Envoi en cours…" : `Payer ${fcfa(total)}`}
      </Bouton>
    </form>
  );
}
