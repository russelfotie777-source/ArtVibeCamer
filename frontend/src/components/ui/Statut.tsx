import type { StatutCandidat, StatutTransaction } from "@/lib/types";

/*
 * Un statut est toujours un mot, jamais une couleur seule : un daltonien, ou
 * un ecran mal calibre, doit pouvoir lire l'information. La couleur ne fait
 * que la renforcer.
 */

type Teinte = "succes" | "alerte" | "danger" | "neutre" | "examen";

const teintes: Record<Teinte, string> = {
  succes: "bg-succes-fond text-succes",
  alerte: "bg-alerte-fond text-alerte",
  danger: "bg-danger-fond text-danger",
  neutre: "bg-appui text-discret",
  // Un dossier a examiner attend une personne, pas un systeme : contour plein.
  examen: "border border-fort text-fort",
};

const candidat: Record<StatutCandidat, Teinte> = {
  draft: "neutre",
  awaiting_payment: "alerte",
  pending_review: "examen",
  active: "succes",
  rejected: "danger",
  withdrawn: "neutre",
  eliminated: "neutre",
};

const transaction: Record<StatutTransaction, Teinte> = {
  pending: "alerte",
  processing: "alerte",
  succeeded: "succes",
  failed: "danger",
  cancelled: "neutre",
  expired: "neutre",
  refunded: "examen",
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
      className={`inline-flex h-6 shrink-0 items-center rounded-pilule px-2 text-xs whitespace-nowrap ${teintes[teinte]}`}
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
