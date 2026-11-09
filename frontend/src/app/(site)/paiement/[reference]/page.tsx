import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SuiviPaiement } from "@/components/SuiviPaiement";
import { lirePublic } from "@/lib/api";
import type { Transaction } from "@/lib/types";

export const metadata: Metadata = {
  title: "Paiement",
  robots: { index: false, follow: false },
};

type ResumeCandidat = {
  candidate_number: string | null;
  display_name: string;
  slug: string;
  status: string;
  status_label: string;
  category: string | null;
};

export default async function PagePaiement({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;

  let transaction: Transaction;
  let candidat: ResumeCandidat | null = null;

  try {
    const reponse = await lirePublic<{
      data: Transaction;
      meta?: { candidate: ResumeCandidat | null };
    }>(`/payments/${encodeURIComponent(reference)}`);

    transaction = reponse.data;
    candidat = reponse.meta?.candidate ?? null;
  } catch {
    notFound();
  }

  return (
    <div className="cadre py-12 md:py-16">
      <div className="max-w-xl">
        <SuiviPaiement initiale={transaction} candidatInitial={candidat} />
      </div>
    </div>
  );
}
