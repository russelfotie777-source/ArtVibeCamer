"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Champ, Saisie } from "@/components/ui/Champ";
import { BASE_PUBLIQUE } from "@/lib/config";
import { fcfa, nombre } from "@/lib/format";
import type { ReponseCommandeBillets, TypeBillet } from "@/lib/types";

type Erreurs = Record<string, string[]>;

// Formulaire d'achat de billets.
// Gere la selection des quantites par categorie de place, le calcul en direct
// et l'envoi vers l'API de billetterie.
export function FormulaireBilletterie({ types }: { types: TypeBillet[] }) {
  const router = useRouter();

  // Quantites choisies par categorie de place (cle = id du type).
  const [quantites, setQuantites] = useState<Record<number, number>>(() => {
    const initiales: Record<number, number> = {};
    for (const t of types) {
      initiales[t.id] = 0;
    }
    return initiales;
  });

  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [message, setMessage] = useState<string | null>(null);

  // Mise a jour de la quantite pour un type donnee.
  function changerQuantite(typeId: number, nouvelleQuantite: number, max: number) {
    const q = Math.max(0, Math.min(nouvelleQuantite, max));
    setQuantites((precedentes) => ({
      ...precedentes,
      [typeId]: q,
    }));
  }

  // Calcul du total des billets et du montant.
  const totalBillets = Object.values(quantites).reduce((a, b) => a + b, 0);
  const montantTotal = types.reduce((acc, t) => {
    const q = quantites[t.id] ?? 0;
    return acc + t.price * q;
  }, 0);

  async function soumettre(evenement: React.FormEvent) {
    evenement.preventDefault();

    if (totalBillets === 0) {
      setMessage("Veuillez sélectionner au moins un billet pour continuer.");
      return;
    }

    setEnvoi(true);
    setErreurs({});
    setMessage(null);

    // Construction du tableau d'articles commandes.
    const items = types
      .filter((t) => (quantites[t.id] ?? 0) > 0)
      .map((t) => ({
        ticket_type_id: t.id,
        quantity: quantites[t.id],
      }));

    try {
      const reponse = await fetch(`${BASE_PUBLIQUE}/ticket-orders`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items,
          buyer_name: nom,
          buyer_phone: telephone,
          buyer_email: email.trim() || null,
        }),
      });

      const charge = await reponse.json().catch(() => null);

      if (!reponse.ok) {
        if (reponse.status === 422) {
          setErreurs(charge?.errors ?? {});
          setMessage(
            charge?.message ??
              "Certaines informations sont incomplètes ou des places ne sont plus disponibles.",
          );
        } else if (reponse.status === 429) {
          setMessage(
            "Trop de tentatives depuis cette connexion. Veuillez patienter un instant.",
          );
        } else {
          setMessage(
            charge?.message ??
              "La commande n’a pas pu être validée. Veuillez réessayer.",
          );
        }
        setEnvoi(false);
        return;
      }

      const resultat = charge as ReponseCommandeBillets;

      // Consignes eventuelles de l'operateur deposees en session.
      if (resultat.payment?.instructions) {
        try {
          sessionStorage.setItem(
            `avc_consignes_${resultat.transaction.reference}`,
            resultat.payment.instructions,
          );
        } catch {
          // Stockage prive bloque : texte par defaut.
        }
      }

      if (resultat.payment?.redirect_url) {
        window.location.href = resultat.payment.redirect_url;
        return;
      }

      router.push(`/paiement/${resultat.transaction.reference}`);
    } catch {
      setMessage(
        "Impossible de joindre le serveur. Vérifiez votre connexion internet.",
      );
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={soumettre} className="grid gap-10">
      {message ? (
        <div
          role="alert"
          className="rounded-region border border-danger bg-danger-fond px-4 py-3"
        >
          <p className="text-sm font-semibold text-danger">{message}</p>
        </div>
      ) : null}

      {/* Selection des places */}
      <fieldset className="grid gap-4">
        <legend className="text-lg font-semibold text-fort">
          1. Choisissez vos places
        </legend>

        {erreurs.items ? (
          <p className="text-sm text-danger">{erreurs.items[0]}</p>
        ) : null}

        <div className="grid gap-4">
          {types.map((type) => {
            const quantite = quantites[type.id] ?? 0;
            const indisponible = !type.is_on_sale || type.is_sold_out;

            return (
              <div
                key={type.id}
                className={`rounded-region border p-5 transition-colors ${
                  quantite > 0
                    ? "border-accent bg-accent/5"
                    : indisponible
                    ? "border-bordure bg-surface/40 opacity-60"
                    : "border-bordure bg-surface"
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-semibold text-fort">
                        {type.name}
                      </h3>
                      {indisponible ? (
                        <span className="rounded-pilule bg-appui px-2.5 py-0.5 text-xs font-semibold text-discret">
                          {type.is_sold_out ? "Épuisé" : "Ventes fermées"}
                        </span>
                      ) : (
                        <span className="montant text-lg font-semibold text-accent">
                          {fcfa(type.price)}
                        </span>
                      )}
                    </div>

                    {type.description ? (
                      <p className="mt-1 text-sm text-discret">
                        {type.description}
                      </p>
                    ) : null}

                    {!indisponible && type.max_purchasable ? (
                      <p className="mt-1 text-xs text-discret">
                        Limite de {type.max_purchasable} places par commande
                      </p>
                    ) : null}
                  </div>

                  {/* Selecteur de quantite */}
                  {!indisponible ? (
                    <div className="flex items-center gap-3 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() =>
                          changerQuantite(
                            type.id,
                            quantite - 1,
                            type.max_purchasable,
                          )
                        }
                        disabled={quantite <= 0}
                        aria-label={`Diminuer la quantité pour ${type.name}`}
                        className="flex size-10 items-center justify-center rounded-controle border border-bordure-forte text-xl font-bold text-fort transition-colors hover:border-fort hover:bg-appui disabled:opacity-40"
                      >
                        −
                      </button>

                      <span className="chiffre w-8 text-center text-lg font-semibold text-fort">
                        {quantite}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          changerQuantite(
                            type.id,
                            quantite + 1,
                            type.max_purchasable,
                          )
                        }
                        disabled={quantite >= type.max_purchasable}
                        aria-label={`Augmenter la quantité pour ${type.name}`}
                        className="flex size-10 items-center justify-center rounded-controle border border-bordure-forte text-xl font-bold text-fort transition-colors hover:border-fort hover:bg-appui disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>

      {/* Coordonnees de l'acheteur */}
      <fieldset className="grid gap-4">
        <legend className="text-lg font-semibold text-fort">
          2. Vos coordonnées
        </legend>

        <Champ
          etiquette="Nom et prénom de l’acheteur"
          pour="buyer_name"
          erreur={erreurs.buyer_name?.[0]}
          aide="Ce nom figurera sur vos reçus et vos billets."
          obligatoire
        >
          <Saisie
            id="buyer_name"
            name="buyer_name"
            autoComplete="name"
            required
            placeholder="Ex : Samuel Eto'o"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            erreur={erreurs.buyer_name?.[0]}
          />
        </Champ>

        <Champ
          etiquette="Numéro Mobile Money"
          pour="buyer_phone"
          erreur={erreurs.buyer_phone?.[0]}
          aide="MTN ou Orange. La demande de débit sécurisé arrivera sur ce numéro."
          obligatoire
        >
          <Saisie
            id="buyer_phone"
            name="buyer_phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="671 23 45 67"
            required
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
            erreur={erreurs.buyer_phone?.[0]}
          />
        </Champ>

        <Champ
          etiquette="Adresse email"
          pour="buyer_email"
          erreur={erreurs.buyer_email?.[0]}
          aide="Facultatif. Vos e-billets et le reçu PDF y seront également expédiés."
        >
          <Saisie
            id="buyer_email"
            name="buyer_email"
            type="email"
            autoComplete="email"
            placeholder="acheteur@domaine.cm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            erreur={erreurs.buyer_email?.[0]}
          />
        </Champ>
      </fieldset>

      {/* Recapitulatif et reglement */}
      <div className="rounded-region border border-bordure bg-surface p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <p className="text-sm text-discret">Total de la commande</p>
            <p className="mt-1 text-sm text-discret">
              <span className="chiffre font-semibold text-fort">
                {nombre(totalBillets)}
              </span>{" "}
              place{totalBillets > 1 ? "s" : ""} sélectionnée{totalBillets > 1 ? "s" : ""}
            </p>
          </div>

          <div className="text-right">
            <span className="montant text-3xl font-semibold text-accent">
              {fcfa(montantTotal)}
            </span>
          </div>
        </div>

        <p className="mt-4 border-t border-bordure pt-4 text-xs text-discret">
          Le débit intervient uniquement après confirmation du code secret sur votre téléphone.
          Vos billets électroniques sont délivrés immédiatement après validation.
        </p>
      </div>

      <Bouton
        type="submit"
        taille="grand"
        chargement={envoi}
        disabled={envoi || totalBillets === 0}
      >
        {envoi
          ? "Génération de la commande…"
          : totalBillets === 0
          ? "Choisissez vos billets"
          : `Commander pour ${fcfa(montantTotal)}`}
      </Bouton>
    </form>
  );
}
