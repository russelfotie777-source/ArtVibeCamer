import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SuiviPaiement } from "@/components/SuiviPaiement";
import { lirePublic } from "@/lib/api";
import type { ResumeCandidatPaiement, ResumeCommandePaiement, Transaction } from "@/lib/types";

export const metadata: Metadata = {
  title: "Paiement",
  robots: { index: false, follow: false },
};

export default async function PagePaiement({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;

  let transaction: Transaction;
  let candidat: ResumeCandidatPaiement | null = null;
  let commande: ResumeCommandePaiement | null = null;

  try {
    const reponse = await lirePublic<{
      data: Transaction;
      meta?: {
        candidate: ResumeCandidatPaiement | null;
        ticket_order: ResumeCommandePaiement | null;
      };
    }>(`/payments/${encodeURIComponent(reference)}`);

    transaction = reponse.data;
    candidat = reponse.meta?.candidate ?? null;
    commande = reponse.meta?.ticket_order ?? null;
  } catch {
    notFound();
  }

  return (
    <div className="cadre py-12 md:py-16">
      <div className="max-w-xl">
        <SuiviPaiement
          initiale={transaction}
          candidatInitial={candidat}
          commandeInitiale={commande}
        />
      </div>
    </div>
  );
}
