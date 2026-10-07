import type { StatutCandidat, StatutTransaction } from "@/lib/types";

/*
 * Un statut est toujours un mot, jamais une couleur seule : un daltonien, ou
 * un ecran mal calibre, doit pouvoir lire l'information. La couleur ne fait
 * que la renforcer.
 */

type Teinte = "sage" | "amber" | "oxblood" | "neutre" | "indigo";

const teintes: Record<Teinte, string> = {
  sage: "bg-sage-wash text-sage border-sage/25",
  amber: "bg-amber-wash text-amber border-amber/25",
  oxblood: "bg-oxblood-wash text-oxblood border-oxblood/25",
  neutre: "bg-paper text-paper-soft border-rule",
  indigo: "bg-ink/6 text-ink border-ink/20",
};

const candidat: Record<StatutCandidat, Teinte> = {
  draft: "neutre",
  awaiting_payment: "amber",
  pending_review: "indigo",
  active: "sage",
  rejected: "oxblood",
  withdrawn: "neutre",
  eliminated: "neutre",
};

const transaction: Record<StatutTransaction, Teinte> = {
  pending: "amber",
  processing: "amber",
  succeeded: "sage",
  failed: "oxblood",
  cancelled: "neutre",
  expired: "neutre",
  refunded: "indigo",
};

export function Statut({
  libelle,
  teinte = "neutre",
}: {
  libelle: string;
  teinte?: Teinte;
}) {
  return (
    <span
      className={`controle inline-flex shrink-0 items-center border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${teintes[teinte]}`}
    >
      {libelle}
    </span>
  );
}

export function StatutCandidatBadge({
  statut,
  libelle,
}: {
  statut: StatutCandidat;
  libelle: string;
}) {
  return <Statut libelle={libelle} teinte={candidat[statut]} />;
}

export function StatutTransactionBadge({
  statut,
  libelle,
}: {
  statut: StatutTransaction;
  libelle: string;
}) {
  return <Statut libelle={libelle} teinte={transaction[statut]} />;
}
