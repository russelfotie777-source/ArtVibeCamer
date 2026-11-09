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
              "Le vote n’a pas pu être enregistré. Réessayez dans un instant.",
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
          className="rounded-region border border-danger bg-danger-fond px-4 py-3"
        >
          <p className="text-sm font-semibold text-danger">{message}</p>
        </div>
      ) : null}

      <fieldset className="grid gap-4">
        <legend className="text-sm font-semibold text-fort">Nombre de voix</legend>

        <div className="mt-2 flex flex-wrap gap-2">
          {PALIERS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setQuantite(n)}
              aria-pressed={quantite === n}
              className={`appui chiffre h-10 min-w-12 rounded-controle px-3 text-sm ${
                quantite === n
                  ? "bg-accent font-semibold text-sur-accent"
                  : "border border-bordure-forte text-fort hover:border-fort hover:bg-appui"
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
          aide={`${fcfa(prix)} la voix.`}
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
            erreur={erreurs.quantity?.[0]}
            className="chiffre max-w-40"
          />
        </Champ>
      </fieldset>

      <Champ
        etiquette="Votre numéro Mobile Money"
        pour="voter_phone"
        erreur={erreurs.voter_phone?.[0]}
        aide="MTN ou Orange. La demande de paiement arrivera sur ce numéro."
        obligatoire
      >
        <Saisie
          id="voter_phone"
          name="voter_phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="671 23 45 67"
          required
          value={telephone}
          onChange={(e) => setTelephone(e.target.value)}
          erreur={erreurs.voter_phone?.[0]}
        />
      </Champ>

      <Champ
        etiquette="Votre nom"
        pour="voter_name"
        erreur={erreurs.voter_name?.[0]}
        aide="Il n’est jamais affiché publiquement."
      >
        <Saisie
          id="voter_name"
          name="voter_name"
          autoComplete="name"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          erreur={erreurs.voter_name?.[0]}
        />
      </Champ>

      <div className="rounded-region border border-bordure bg-appui px-4 py-3">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm text-discret">À payer</span>
          <span className="montant text-2xl">{fcfa(total)}</span>
        </div>
        <p className="mt-1 text-sm text-discret">
          Les voix comptent une fois le paiement validé sur votre téléphone.
          Rien n’est débité avant.
        </p>
      </div>

      <Bouton type="submit" taille="grand" chargement={envoi} disabled={envoi}>
        {envoi ? "Envoi…" : `Payer ${fcfa(total)}`}
      </Bouton>
    </form>
  );
}
