"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Champ, Saisie } from "@/components/ui/Champ";
import { BASE_PUBLIQUE } from "@/lib/config";
import { fcfa } from "@/lib/format";
import type { Transaction } from "@/lib/types";

type ResumeCandidat = {
  candidate_number: string | null;
  display_name: string;
  slug: string;
  status: string;
  status_label: string;
  category: string | null;
};

type Reponse = { data: Transaction; meta?: { candidate: ResumeCandidat | null } };

const INTERVALLE = 4000;
const DUREE_MAX = 3 * 60 * 1000;

export function SuiviPaiement({
  initiale,
  candidatInitial,
}: {
  initiale: Transaction;
  candidatInitial: ResumeCandidat | null;
}) {
  const router = useRouter();

  const [transaction, setTransaction] = useState(initiale);
  const [candidat, setCandidat] = useState(candidatInitial);
  const [abandonne, setAbandonne] = useState(false);
  const [relance, setRelance] = useState(false);
  const [erreurRelance, setErreurRelance] = useState<string | null>(null);

  // Instant du premier affichage, pose au montage : Date.now() pendant le
  // rendu produirait une valeur instable a chaque re-rendu.
  const depart = useRef<number | null>(null);

  /*
   * Les consignes de l'operateur (code USSD par exemple) sont produites a la
   * creation du paiement : le formulaire les depose dans sessionStorage avant
   * de naviguer ici, cet ecran ne pouvant pas les redemander.
   *
   * Lecture par useSyncExternalStore plutot que par un effet : c'est l'API
   * prevue pour lire un etat exterieur a React, elle evite un rendu en
   * cascade, et l'instantane serveur a null empeche toute divergence
   * d'hydratation.
   */
  const instructions = useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return sessionStorage.getItem(`avc_consignes_${initiale.reference}`);
      } catch {
        // Navigation privee ou stockage bloque : texte generique.
        return null;
      }
    },
    () => null,
  );

  const interroger = useCallback(async () => {
    try {
      const reponse = await fetch(`${BASE_PUBLIQUE}/payments/${initiale.reference}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (!reponse.ok) return;

      const charge = (await reponse.json()) as Reponse;
      setTransaction(charge.data);
      if (charge.meta?.candidate) setCandidat(charge.meta.candidate);
    } catch {
      // Coupure passagere : la prochaine interrogation reprendra.
    }
  }, [initiale.reference]);

  useEffect(() => {
    if (transaction.is_final || abandonne) return;

    depart.current ??= Date.now();

    const minuterie = setInterval(() => {
      if (Date.now() - (depart.current ?? Date.now()) > DUREE_MAX) {
        setAbandonne(true);
        return;
      }
      void interroger();
    }, INTERVALLE);

    return () => clearInterval(minuterie);
  }, [transaction.is_final, abandonne, interroger]);

  async function relancerPaiement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRelance(true);
    setErreurRelance(null);

    const donnees = new FormData(event.currentTarget);

    try {
      const reponse = await fetch(
        `${BASE_PUBLIQUE}/registrations/${initiale.reference}/retry`,
        {
          method: "POST",
          headers: { Accept: "application/json" },
          body: donnees,
        },
      );

      const charge = await reponse.json().catch(() => null);

      if (!reponse.ok) {
        setErreurRelance(
          charge?.errors?.payer_phone?.[0] ??
            charge?.message ??
            "La demande de paiement n'a pas pu être renvoyée.",
        );
        setRelance(false);
        return;
      }

      if (charge.payment?.instructions) {
        try {
          sessionStorage.setItem(
            `avc_consignes_${charge.transaction.reference}`,
            charge.payment.instructions,
          );
        } catch {
          /* stockage indisponible */
        }
      }

      // Page hebergee de la passerelle : sortie hors de l'application.
      if (charge.payment?.redirect_url) {
        window.location.href = charge.payment.redirect_url;
        return;
      }

      // La relance cree une nouvelle transaction : on suit celle-la.
      router.push(`/paiement/${charge.transaction.reference}`);
    } catch {
      setErreurRelance("Impossible de joindre le serveur. Réessayez.");
      setRelance(false);
    }
  }

  /* --- Paiement encaisse ------------------------------------------- */
  if (transaction.status === "succeeded") {
    return (
      <div className="panneau border border-ink-line bg-ink-raised">
        <div className="border-b border-ink-line px-7 py-8">
          <p className="text-sm text-sage-clair">Paiement reçu</p>
          <h1 className="mt-2 font-display text-display-sm font-extrabold">
            Votre inscription est enregistrée
          </h1>
        </div>

        {candidat?.candidate_number ? (
          <div className="border-b border-ink-line px-7 py-7">
            <p className="text-sm text-ink-soft">Votre numéro de candidat</p>
            <p className="montant mt-1 text-4xl text-brass">
              {candidat.candidate_number}
            </p>
            <p className="mt-3 text-sm text-ink-soft">
              {candidat.display_name}
              {candidat.category ? ` — ${candidat.category}` : ""}
            </p>
          </div>
        ) : null}

        <dl className="divide-y divide-ink-line border-b border-ink-line text-sm">
          <div className="flex items-baseline justify-between gap-4 px-7 py-4">
            <dt className="text-ink-soft">Montant réglé</dt>
            <dd className="montant text-lg">{fcfa(transaction.amount)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 px-7 py-4">
            <dt className="text-ink-soft">Référence</dt>
            <dd className="chiffre">{transaction.reference}</dd>
          </div>
          {transaction.payment_method_label ? (
            <div className="flex items-baseline justify-between gap-4 px-7 py-4">
              <dt className="text-ink-soft">Moyen</dt>
              <dd>{transaction.payment_method_label}</dd>
            </div>
          ) : null}
        </dl>

        <div className="px-7 py-7">
          <h2 className="font-display text-lg font-extrabold">Et maintenant</h2>
          <p className="prose-etroit mt-2 text-sm leading-relaxed text-ink-soft">
            L&apos;organisation vérifie votre dossier. Dès qu&apos;il est
            validé, votre page de candidat devient visible et le public peut
            voter pour vous. Conservez votre numéro et votre référence : ils
            serviront en cas de question.
          </p>

          <Link
            href="/"
            className="mt-6 inline-block text-sm text-brass underline decoration-brass/40 underline-offset-4 hover:decoration-brass"
          >
            Revenir à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  /* --- Paiement non abouti ----------------------------------------- */
  if (transaction.is_final) {
    return (
      <div className="panneau border border-ink-line bg-ink-raised">
        <div className="border-b border-ink-line px-7 py-8">
          <p className="text-sm text-brass">{transaction.status_label}</p>
          <h1 className="mt-2 font-display text-display-sm font-extrabold">
            Le paiement n&apos;a pas abouti
          </h1>
          <p className="prose-etroit mt-4 text-sm leading-relaxed text-ink-soft">
            {transaction.failure_reason ??
              "La transaction a été interrompue avant la validation."}{" "}
            Votre dossier est conservé : renvoyez simplement une demande de
            paiement, sans ressaisir le formulaire.
          </p>
        </div>

        <form onSubmit={relancerPaiement} className="px-7 py-7">
          <div className="[&_label]:text-paper [&_p]:text-ink-soft">
            <Champ
              etiquette="Numéro Mobile Money"
              pour="payer_phone"
              erreur={erreurRelance ?? undefined}
              aide="Laissez vide pour réutiliser le numéro précédent."
            >
              <Saisie
                id="payer_phone"
                name="payer_phone"
                type="tel"
                inputMode="tel"
                placeholder="671 23 45 67"
                erreur={erreurRelance ?? undefined}
              />
            </Champ>
          </div>

          <Bouton type="submit" taille="grand" disabled={relance} className="mt-5 w-full">
            {relance ? "Envoi en cours" : `Payer ${fcfa(transaction.amount)}`}
          </Bouton>
        </form>
      </div>
    );
  }

  /* --- Attente de validation par le payeur -------------------------- */
  return (
    <div className="panneau border border-ink-line bg-ink-raised">
      <div className="border-b border-ink-line px-7 py-8">
        <p className="en-attente text-sm text-brass">
          {abandonne ? "Vérification interrompue" : "En attente de votre validation"}
        </p>
        <h1 className="mt-2 font-display text-display-sm font-extrabold">
          {abandonne
            ? "Toujours pas de confirmation"
            : "Validez le paiement sur votre téléphone"}
        </h1>
      </div>

      <div className="border-b border-ink-line px-7 py-7">
        <p className="text-sm text-ink-soft">Montant à régler</p>
        <p className="montant mt-1 text-4xl text-brass">{fcfa(transaction.amount)}</p>
      </div>

      <div className="px-7 py-7">
        {abandonne ? (
          <>
            <p className="prose-etroit text-sm leading-relaxed text-ink-soft">
              Nous n&apos;avons pas reçu de confirmation de l&apos;opérateur.
              Si vous avez été débité, votre inscription sera enregistrée
              automatiquement : revenez sur cette page dans quelques minutes.
            </p>
            <Bouton
              ton="contour-clair"
              onClick={() => {
                depart.current = Date.now();
                setAbandonne(false);
                void interroger();
              }}
              className="mt-5"
            >
              Vérifier à nouveau
            </Bouton>
          </>
        ) : (
          <>
            <p className="prose-etroit text-sm leading-relaxed text-ink-soft">
              {instructions ??
                "Une demande de paiement a été envoyée sur votre téléphone. Saisissez votre code secret Mobile Money pour la valider. Cette page se met à jour automatiquement."}
            </p>
            <p className="mt-5 text-xs text-ink-soft/80">
              Ne fermez pas cette page. Référence&nbsp;
              <span className="chiffre text-ink-soft">{transaction.reference}</span>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
