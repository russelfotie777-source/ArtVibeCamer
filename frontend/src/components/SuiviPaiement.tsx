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

const DUREE_MAX = 3 * 60 * 1000;

/**
 * Cadence degressive.
 *
 * Les premieres secondes sont celles ou le payeur saisit son code : on
 * interroge souvent pour que la confirmation paraisse instantanee. Passe ce
 * moment, la probabilite qu'il valide a cet instant precis s'effondre, et
 * continuer au meme rythme ne fait que charger nos serveurs et ceux de la
 * passerelle — cent candidats en attente suffisent a saturer.
 */
function cadence(ecouleMs: number): number {
  if (ecouleMs < 20_000) return 4_000;
  if (ecouleMs < 60_000) return 8_000;
  return 15_000;
}

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

    let actif = true;
    let minuterie: ReturnType<typeof setTimeout>;

    // Chaine de setTimeout plutot qu'un setInterval : l'intervalle doit
    // s'allonger au fil de l'attente, ce qu'un interval fixe ne permet pas.
    const planifier = () => {
      const ecoule = Date.now() - (depart.current ?? Date.now());

      minuterie = setTimeout(async () => {
        if (!actif) return;

        if (Date.now() - (depart.current ?? Date.now()) > DUREE_MAX) {
          setAbandonne(true);
          return;
        }

        await interroger();

        // Replanifie apres la reponse, jamais pendant : sinon une API lente
        // verrait les requetes s'empiler.
        if (actif) planifier();
      }, cadence(ecoule));
    };

    planifier();

    return () => {
      actif = false;
      clearTimeout(minuterie);
    };
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
            "La demande de paiement n’a pas pu être renvoyée.",
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

  const estVote = transaction.type === "vote";

  /* --- Paiement encaisse ------------------------------------------- */
  if (transaction.status === "succeeded") {
    return (
      <section className="overflow-hidden rounded-region border border-bordure bg-surface">
        <div className="border-b border-bordure p-6">
          <p className="text-sm font-semibold text-succes">Paiement reçu</p>
          <h1 className="mt-2 text-4xl tracking-affiche">
            {estVote ? "Vos voix sont comptées" : "Votre inscription est enregistrée"}
          </h1>
        </div>

        {candidat?.candidate_number ? (
          <div className="border-b border-bordure p-6">
            <p className="text-sm text-discret">Votre numéro de candidat</p>
            <p className="montant mt-1 text-5xl tracking-affiche text-accent">
              {candidat.candidate_number}
            </p>
            <p className="mt-2 text-sm text-discret">
              {candidat.display_name}
              {candidat.category ? `, ${candidat.category}` : ""}
            </p>
          </div>
        ) : null}

        <dl className="divide-y divide-bordure border-b border-bordure text-sm">
          <div className="flex items-baseline justify-between gap-4 px-6 py-3">
            <dt className="text-discret">Montant réglé</dt>
            <dd className="montant text-lg">{fcfa(transaction.amount)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 px-6 py-3">
            <dt className="text-discret">Référence</dt>
            <dd className="chiffre text-fort">{transaction.reference}</dd>
          </div>
          {transaction.payment_method_label ? (
            <div className="flex items-baseline justify-between gap-4 px-6 py-3">
              <dt className="text-discret">Moyen</dt>
              <dd className="text-fort">{transaction.payment_method_label}</dd>
            </div>
          ) : null}
        </dl>

        <div className="p-6">
          {estVote ? null : (
            <>
              <h2 className="text-lg">La suite</h2>
              <p className="mt-2 text-sm">
                L’organisation vérifie votre dossier. Une fois validé, votre
                page de candidat devient visible et le public peut voter pour
                vous. Gardez votre numéro et votre référence&nbsp;: ils servent
                en cas de question.
              </p>
            </>
          )}

          <div className={`flex flex-wrap items-center gap-4 ${estVote ? "" : "mt-6"}`}>
            {/*
              Lien direct vers l'API plutot qu'un appel depuis le navigateur :
              le PDF arrive en piece jointe, le navigateur le telecharge ou
              l'ouvre selon son reglage, et rien n'est a garder en memoire.
            */}
            <a
              href={`${BASE_PUBLIQUE}/payments/${transaction.reference}/recu`}
              className="appui inline-flex h-10 items-center rounded-controle border border-bordure-forte px-3 text-sm text-fort hover:border-fort hover:bg-appui"
            >
              Télécharger le reçu (PDF)
            </a>

            <Link
              href={estVote ? "/candidats" : "/"}
              className="text-sm text-lien underline decoration-1 underline-offset-4"
            >
              {estVote ? "Voir les candidats" : "Revenir à l’accueil"}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  /* --- Paiement non abouti ----------------------------------------- */
  if (transaction.is_final) {
    return (
      <section className="overflow-hidden rounded-region border border-bordure bg-surface">
        <div className="border-b border-bordure p-6">
          <p className="text-sm font-semibold text-danger">{transaction.status_label}</p>
          <h1 className="mt-2 text-4xl tracking-affiche">Le paiement n’a pas abouti</h1>
          <p className="mt-4 text-sm">
            {/* Le motif vient de l'operateur, souvent sans point final. */}
            {transaction.failure_reason
              ? transaction.failure_reason.replace(/([^.!?])\s*$/, "$1.")
              : "La transaction a été interrompue avant la validation."}{" "}
            {estVote
              ? "Aucune voix n’a été débitée ni comptée."
              : "Votre dossier est conservé : renvoyez la demande de paiement, sans ressaisir le formulaire."}
          </p>
        </div>

        {/* La relance n'existe que pour une inscription : un vote se refait depuis la fiche. */}
        {estVote ? (
          <div className="p-6">
            <Link
              href="/candidats"
              className="text-sm text-lien underline decoration-1 underline-offset-4"
            >
              Revenir aux candidats
            </Link>
          </div>
        ) : (
          <form onSubmit={relancerPaiement} className="p-6">
            {/*
              Le numero est redemande a chaque relance plutot que repris en
              silence. Une relance fait suite a un echec, et la premiere cause
              d'echec est un numero errone ou un compte non approvisionne :
              rejouer le meme numero sans le montrer conduit a enchainer les
              echecs sans comprendre.
            */}
            <Champ
              etiquette="Numéro Mobile Money"
              pour="payer_phone"
              erreur={erreurRelance ?? undefined}
              aide="MTN ou Orange. La demande de paiement arrivera sur ce numéro."
              obligatoire
            >
              <Saisie
                id="payer_phone"
                name="payer_phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                placeholder="671 23 45 67"
                erreur={erreurRelance ?? undefined}
              />
            </Champ>

            <Bouton
              type="submit"
              taille="grand"
              chargement={relance}
              disabled={relance}
              className="mt-6 w-full"
            >
              {relance ? "Envoi…" : `Payer ${fcfa(transaction.amount)}`}
            </Bouton>
          </form>
        )}
      </section>
    );
  }

  /* --- Attente de validation par le payeur -------------------------- */
  return (
    <section className="overflow-hidden rounded-region border border-bordure bg-surface">
      <div className="border-b border-bordure p-6">
        <p
          role="status"
          className={`flex items-center gap-2 text-sm font-semibold ${abandonne ? "text-alerte" : "text-lien"}`}
        >
          {abandonne ? null : (
            <span
              aria-hidden="true"
              className="size-4 animate-spin rounded-pilule border-2 border-current border-r-transparent"
            />
          )}
          {abandonne ? "Vérification interrompue" : "En attente de votre validation…"}
        </p>
        <h1 className="mt-2 text-4xl tracking-affiche">
          {abandonne ? "Toujours pas de confirmation" : "Validez sur votre téléphone"}
        </h1>
      </div>

      <div className="border-b border-bordure p-6">
        <p className="text-sm text-discret">Montant à régler</p>
        <p className="montant mt-1 text-5xl tracking-affiche text-accent">
          {fcfa(transaction.amount)}
        </p>
      </div>

      <div className="p-6">
        {abandonne ? (
          <>
            <p className="text-sm">
              L’opérateur n’a pas encore confirmé. Si vous avez été
              débité, le paiement sera enregistré automatiquement&nbsp;: revenez
              sur cette page dans quelques minutes.
            </p>
            <Bouton
              ton="secondaire"
              onClick={() => {
                depart.current = Date.now();
                setAbandonne(false);
                void interroger();
              }}
              className="mt-4"
            >
              Vérifier à nouveau
            </Bouton>
          </>
        ) : (
          <>
            <p className="text-sm">
              {instructions ??
                "Une demande de paiement est arrivée sur votre téléphone. Saisissez votre code secret Mobile Money pour la valider. Cette page se met à jour toute seule."}
            </p>
            <p className="mt-4 text-sm text-discret">
              Gardez cette page ouverte. Référence{" "}
              <span className="chiffre text-texte">{transaction.reference}</span>
            </p>
          </>
        )}
      </div>
    </section>
  );
}
