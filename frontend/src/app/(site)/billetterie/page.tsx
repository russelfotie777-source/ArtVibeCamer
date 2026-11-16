import type { Metadata } from "next";
import { FormulaireBilletterie } from "@/components/FormulaireBilletterie";
import { lirePublic } from "@/lib/api";
import type { TypeBillet } from "@/lib/types";

export const metadata: Metadata = {
  title: "Billetterie Officielle",
  description:
    "Réservez vos places pour le grand spectacle et les soirées de gala d'ArtVibeCamer.",
};

// Page publique de billetterie.
// Charge les categories de places disponibles (Standard, VIP, VVIP)
// et presente le formulaire d'achat avec selection des quantites.
export default async function PageBilletterie() {
  let types: TypeBillet[] = [];

  try {
    const reponse = await lirePublic<{ data: TypeBillet[] }>("/ticket-types");
    types = reponse.data;
  } catch {
    // Cas ou l'API ne repond pas.
  }

  const billetterieOuverte = types.length > 0 && types.some((t) => t.is_on_sale && !t.is_sold_out);

  return (
    <div className="cadre py-12 md:py-16">
      <header className="max-w-2xl">
        <h1 className="text-6xl tracking-affiche text-fort">Billetterie Officielle</h1>
        <p className="mt-4 text-lg text-discret">
          Réservez vos places pour le grand spectacle et les prestations en direct d’ArtVibeCamer.
          Chaque billet comporte un QR code unique infalsifiable.
        </p>
      </header>

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Formulaire principal */}
        <main>
          {billetterieOuverte ? (
            <FormulaireBilletterie types={types} />
          ) : (
            <div className="rounded-region border border-bordure bg-surface p-8 text-center">
              <h2 className="text-2xl font-semibold text-fort">
                Ventes fermées
              </h2>
              <p className="mt-3 text-sm text-discret max-w-md mx-auto">
                La billetterie n’est pas ouverte actuellement ou les places sont épuisées.
                Revenez très prochainement pour l’ouverture des prochaines sessions.
              </p>
            </div>
          )}
        </main>

        {/* Informations pratiques */}
        <aside className="space-y-6">
          <div className="rounded-region border border-bordure bg-surface p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-discret">
              Accès à l’événement
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-fort">
              <li className="flex items-start gap-2">
                <span className="text-accent font-bold">✓</span>
                <span>E-billet délivré dès confirmation du paiement mobile</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent font-bold">✓</span>
                <span>Scan rapide sur votre téléphone à l’entrée ou version imprimée</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent font-bold">✓</span>
                <span>Code dictable court de secours en cas de problème d’écran</span>
              </li>
            </ul>
          </div>

          <div className="rounded-region border border-bordure bg-appui p-6 text-sm">
            <h3 className="font-semibold text-fort">Une question sur vos billets ?</h3>
            <p className="mt-2 text-discret">
              Contactez l’organisation à tout moment avec votre référence de commande pour toute assistance.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
