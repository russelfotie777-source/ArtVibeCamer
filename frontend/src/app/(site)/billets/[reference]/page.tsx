import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { BilletCarte } from "@/components/BilletCarte";
import { BoutonImprimer } from "@/components/BoutonImprimer";
import { BASE_PUBLIQUE } from "@/lib/config";
import { ErreurApi, lirePublic } from "@/lib/api";
import { dateLongue } from "@/lib/format";
import type { CommandeBillets, Enveloppe, Reglages } from "@/lib/types";

export const metadata: Metadata = {
  title: "Vos Billets d’Accès",
  robots: { index: false, follow: false },
};

// Page de retrait et affichage des billets d'une commande.
// Consomme GET /api/v1/ticket-orders/{reference} et genere
// les QR codes a partir des jetons qr_token exposes des que la commande est payee.
export default async function PageBillets({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;

  let commande: CommandeBillets;
  let reglages: Reglages | null = null;

  try {
    const [reponseCommande, reponseReglages] = await Promise.all([
      lirePublic<{ data: CommandeBillets }>(
        `/ticket-orders/${encodeURIComponent(reference)}`,
      ),
      lirePublic<Enveloppe<Reglages>>("/settings").catch(() => null),
    ]);

    commande = reponseCommande.data;
    reglages = reponseReglages?.data ?? null;
  } catch (erreur) {
    if (erreur instanceof ErreurApi && erreur.statut === 404) {
      notFound();
    }
    notFound();
  }

  const estPayee = commande.status === "paid";
  const billets = commande.tickets ?? [];

  // Generation asynchrone des QR codes en Data URL pour chaque billet.
  const qrCodes = await Promise.all(
    billets.map(async (b) => {
      if (!b.qr_token) return null;
      try {
        return await QRCode.toDataURL(b.qr_token, {
          margin: 1,
          width: 256,
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
        });
      } catch {
        return null;
      }
    }),
  );

  const lieu = [reglages?.event_venue, reglages?.event_city]
    .filter(Boolean)
    .join(", ");

  const dateAffichee = reglages?.event_date
    ? dateLongue(reglages.event_date)
    : null;

  return (
    <div className="cadre py-10 md:py-16">
      {/* Fil d'ariane et actions d'en-tete */}
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <nav aria-label="Fil d’Ariane" className="text-sm">
          <Link
            href="/billetterie"
            className="text-discret underline decoration-bordure-forte underline-offset-4 transition-colors hover:text-lien hover:decoration-lien"
          >
            ← Retour à la billetterie
          </Link>
        </nav>

        {estPayee ? (
          <div className="flex items-center gap-3">
            <BoutonImprimer />

            {commande.transaction?.reference ? (
              <a
                href={`${BASE_PUBLIQUE}/payments/${commande.transaction.reference}/recu`}
                className="appui inline-flex h-10 items-center rounded-controle border border-bordure-forte px-3 text-sm text-fort hover:border-fort hover:bg-appui"
              >
                Reçu de paiement (PDF)
              </a>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Titre et resume de commande */}
      <header className="mt-6 border-b border-bordure pb-6 print:border-black print:pb-4">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h1 className="text-5xl tracking-affiche text-fort print:text-black">
              Vos Billets d’Accès
            </h1>
            <p className="mt-2 text-discret print:text-neutral-700">
              Commande{" "}
              <span className="chiffre font-semibold text-fort print:text-black">
                {commande.reference}
              </span>{" "}
              au nom de{" "}
              <span className="font-semibold text-fort print:text-black">
                {commande.buyer_name}
              </span>
            </p>
          </div>

          <span
            className={`rounded-pilule px-3 py-1 text-xs font-semibold ${
              estPayee
                ? "bg-succes-fond text-succes print:border print:border-black print:text-black"
                : "bg-alerte-fond text-alerte print:border print:border-black print:text-black"
            }`}
          >
            {commande.status_label}
          </span>
        </div>
      </header>

      {/* Alerte si la commande n'est pas encore payee */}
      {!estPayee ? (
        <div className="mt-8 rounded-region border border-alerte bg-alerte-fond/40 p-6 text-center">
          <h2 className="text-xl font-semibold text-fort">
            Paiement en attente de confirmation
          </h2>
          <p className="mt-2 text-sm text-discret max-w-lg mx-auto">
            Les QR codes et billets d’accès seront débloqués automatiquement dès
            que l’opérateur Mobile Money aura confirmé votre règlement.
          </p>

          {commande.transaction?.reference ? (
            <div className="mt-6">
              <Link
                href={`/paiement/${commande.transaction.reference}`}
                className="appui inline-flex h-10 items-center rounded-controle bg-accent px-5 text-sm font-semibold text-sur-accent hover:bg-accent-survol"
              >
                Suivre ou valider le paiement
              </Link>
            </div>
          ) : null}
        </div>
      ) : (
        <main className="mt-8 space-y-10">
          {/* Consignes pour l'entree */}
          <div className="rounded-region border border-bordure bg-surface p-4 text-xs text-discret flex flex-wrap items-center justify-between gap-3 print:hidden">
            <span>
              💡 Pour faciliter le scan à l’entrée, augmentez la luminosité de
              votre écran au maximum.
            </span>
            <span>Un QR code = 1 seule entrée autorisée.</span>
          </div>

          {/* Liste des billets individuels */}
          <div className="grid gap-6">
            {billets.map((billet, index) => (
              <BilletCarte
                key={billet.code}
                billet={billet}
                qrDataUrl={qrCodes[index]}
                nomAcheteur={commande.buyer_name}
                nomEvenement={reglages?.event_name}
                lieu={lieu}
                dateEvenement={dateAffichee}
              />
            ))}
          </div>
        </main>
      )}
    </div>
  );
}
