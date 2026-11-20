"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { sauvegarderReglages } from "@/app/admin/actions";
import type { ReglageItem } from "@/lib/types";

export function GestionReglages({
  reglagesInitiaux,
  peutGerer,
}: {
  reglagesInitiaux: ReglageItem[];
  peutGerer: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Dictionnaire local des cles / valeurs
  const [valeurs, setValeurs] = useState<Record<string, string | boolean>>(() => {
    const init: Record<string, string | boolean> = {};
    for (const r of reglagesInitiaux) {
      if (r.type === "boolean") {
        init[r.key] = r.value === "1" || r.value === "true";
      } else {
        init[r.key] = r.value ?? "";
      }
    }
    return init;
  });

  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  function changerValeur(cle: string, nouvelleValeur: string | boolean) {
    setValeurs((prev) => ({ ...prev, [cle]: nouvelleValeur }));
  }

  async function basculerInterrupteurDirect(cle: string, nouvelEtat: boolean) {
    changerValeur(cle, nouvelEtat);
    if (!peutGerer) return;

    setErreur(null);
    setSucces(null);

    const res = await sauvegarderReglages([{ key: cle, value: nouvelEtat }]);
    if (res.erreur) {
      setErreur(res.erreur);
      // Revenir a l'etat precedent en cas d'erreur
      changerValeur(cle, !nouvelEtat);
    } else {
      setSucces(`Interrupteur mis à jour : ${cle}`);
      startTransition(() => {
        router.refresh();
      });
    }
  }

  async function enregistrerTousLesReglages(e: React.FormEvent) {
    e.preventDefault();
    if (!peutGerer) return;

    setErreur(null);
    setSucces(null);

    const payload = Object.entries(valeurs).map(([key, value]) => ({
      key,
      value,
    }));

    const res = await sauvegarderReglages(payload);
    if (res.erreur) {
      setErreur(res.erreur);
    } else {
      setSucces(res.succes ?? "Tous les réglages ont été enregistrés avec succès.");
      startTransition(() => {
        router.refresh();
      });
    }
  }

  // Interrupteurs jour J
  const interrupteurs = [
    {
      cle: "registration_enabled",
      titre: "Inscriptions ouvertes",
      description: "Permet aux candidats de soumettre leur dossier et de payer leurs frais d'inscription en ligne.",
    },
    {
      cle: "voting_enabled",
      titre: "Votes du public ouverts",
      description: "Active l'achat de voix sur les fiches des candidats et la prise en compte des votes payés.",
    },
    {
      cle: "ticketing_enabled",
      titre: "Billetterie en ligne ouverte",
      description: "Autorise l'achat de billets Standard, VIP et VVIP sur la billetterie publique.",
    },
    {
      cle: "results_public",
      titre: "Page de résultats publique",
      description: "Affiche le classement et le podium public sur /resultats. Si désactivé, une annonce d'attente est affichée.",
    },
    {
      cle: "show_vote_counts",
      titre: "Afficher le décompte exact des voix",
      description: "Affiche le nombre précis de voix obtenues sur les classements publics au lieu de simples rangs.",
    },
    {
      cle: "auto_approve_candidates",
      titre: "Validation automatique des candidats",
      description: "Publie immédiatement les candidats dès confirmation du paiement sans attente de modération humaine.",
    },
  ];

  return (
    <form onSubmit={enregistrerTousLesReglages} className="space-y-8">
      {/* Messages */}
      {succes ? (
        <div className="rounded-controle bg-[#11953f]/10 p-4 text-sm font-semibold text-[#11953f] border border-[#11953f]/20">
          {succes}
        </div>
      ) : null}

      {erreur ? (
        <div className="rounded-controle bg-[#c70e20]/10 p-4 text-sm font-semibold text-[#c70e20] border border-[#c70e20]/20">
          {erreur}
        </div>
      ) : null}

      {/* Section 1 : Interrupteurs du Jour J (Action immediate) */}
      <div className="rounded-surface border border-bordure bg-surface p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-lg font-bold text-fort">
            Interrupteurs de direct (Jour J)
          </h2>
          <p className="text-xs text-discret mt-0.5">
            Basculez instantanément l’ouverture ou la fermeture des modules sans nécessiter de redéploiement.
          </p>
        </div>

        <div className="divide-y divide-bordure border-y border-bordure">
          {interrupteurs.map((item) => {
            const actif = Boolean(valeurs[item.cle]);

            return (
              <div
                key={item.cle}
                className="flex items-center justify-between py-4 gap-4"
              >
                <div className="pr-4">
                  <span className="text-sm font-semibold text-fort block">
                    {item.titre}
                  </span>
                  <p className="text-xs text-discret mt-0.5 max-w-xl">
                    {item.description}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={!peutGerer || isPending}
                  onClick={() => basculerInterrupteurDirect(item.cle, !actif)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-pilule border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                    actif ? "bg-[#11953f]" : "bg-bordure-forte"
                  }`}
                  role="switch"
                  aria-checked={actif}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      actif ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2 : Identite & Programmation de l'evenement */}
      <div className="rounded-surface border border-bordure bg-surface p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-bold text-fort">
            Identité et informations événement
          </h2>
          <p className="text-xs text-discret mt-0.5">
            Textes d’accroche, date officielle et lieux des castings affichés sur le site public.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 text-xs">
          <div>
            <label htmlFor="reg-event-name" className="block font-semibold text-texte mb-1">
              Nom de l’événement
            </label>
            <input
              id="reg-event-name"
              type="text"
              value={String(valeurs["event_name"] ?? "")}
              onChange={(e) => changerValeur("event_name", e.target.value)}
              className="w-full rounded-controle border border-bordure bg-fond px-3 py-2 text-sm text-texte focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="reg-event-venue" className="block font-semibold text-texte mb-1">
              Lieu de la finale
            </label>
            <input
              id="reg-event-venue"
              type="text"
              value={String(valeurs["event_venue"] ?? "")}
              onChange={(e) => changerValeur("event_venue", e.target.value)}
              className="w-full rounded-controle border border-bordure bg-fond px-3 py-2 text-sm text-texte focus:border-accent focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="reg-event-tagline" className="block font-semibold text-texte mb-1">
              Accroche principale (Slogan Hero)
            </label>
            <input
              id="reg-event-tagline"
              type="text"
              value={String(valeurs["event_tagline"] ?? "")}
              onChange={(e) => changerValeur("event_tagline", e.target.value)}
              className="w-full rounded-controle border border-bordure bg-fond px-3 py-2 text-sm text-texte focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="reg-casting-douala" className="block font-semibold text-texte mb-1">
              Détail casting Douala
            </label>
            <input
              id="reg-casting-douala"
              type="text"
              value={String(valeurs["casting_douala"] ?? "")}
              onChange={(e) => changerValeur("casting_douala", e.target.value)}
              className="w-full rounded-controle border border-bordure bg-fond px-3 py-2 text-xs text-texte focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="reg-casting-yaounde" className="block font-semibold text-texte mb-1">
              Détail casting Yaoundé
            </label>
            <input
              id="reg-casting-yaounde"
              type="text"
              value={String(valeurs["casting_yaounde"] ?? "")}
              onChange={(e) => changerValeur("casting_yaounde", e.target.value)}
              className="w-full rounded-controle border border-bordure bg-fond px-3 py-2 text-xs text-texte focus:border-accent focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Section 3 : Coordonnees & Contact officiel */}
      <div className="rounded-surface border border-bordure bg-surface p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-bold text-fort">
            Contacts et assistance Mobile Money
          </h2>
          <p className="text-xs text-discret mt-0.5">
            Numéros affichés aux candidats en cas de rejet ou de relance de paiement.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 text-xs">
          <div>
            <label htmlFor="reg-contact-phone" className="block font-semibold text-texte mb-1">
              Téléphone principal (Orange Money / MTN)
            </label>
            <input
              id="reg-contact-phone"
              type="text"
              value={String(valeurs["contact_phone"] ?? "")}
              onChange={(e) => changerValeur("contact_phone", e.target.value)}
              className="w-full rounded-controle border border-bordure bg-fond px-3 py-2 text-sm text-texte focus:border-accent focus:outline-none font-mono"
            />
          </div>

          <div>
            <label htmlFor="reg-contact-phone-2" className="block font-semibold text-texte mb-1">
              Téléphone secondaire
            </label>
            <input
              id="reg-contact-phone-2"
              type="text"
              value={String(valeurs["contact_phone_2"] ?? "")}
              onChange={(e) => changerValeur("contact_phone_2", e.target.value)}
              className="w-full rounded-controle border border-bordure bg-fond px-3 py-2 text-sm text-texte focus:border-accent focus:outline-none font-mono"
            />
          </div>
        </div>
      </div>

      {/* Bouton global d'enregistrement */}
      {peutGerer ? (
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-controle bg-accent px-6 py-2.5 text-sm font-semibold text-sur-accent hover:bg-accent-survol disabled:opacity-50 transition-colors shadow-sm"
          >
            {isPending ? "Enregistrement général..." : "Enregistrer tous les réglages"}
          </button>
        </div>
      ) : null}
    </form>
  );
}
