"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { modifierTypeBillet } from "@/app/admin/actions";
import { fcfa } from "@/lib/format";
import type { TypeBilletAdmin } from "@/lib/types";

export function GestionBilletterie({
  billetsInitiaux,
  peutGerer,
}: {
  billetsInitiaux: TypeBilletAdmin[];
  peutGerer: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [billetEnEdition, setBilletEnEdition] = useState<TypeBilletAdmin | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  // Formulaire d'edition
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [prix, setPrix] = useState(0);
  const [jaugeTotale, setJaugeTotale] = useState<number | null>(null);
  const [maxParCommande, setMaxParCommande] = useState(10);
  const [estActif, setEstActif] = useState(true);

  // Totaux consolides
  const totalBilletsVendus = billetsInitiaux.reduce((acc, b) => acc + b.quantity_sold, 0);
  const totalBilletsReserves = billetsInitiaux.reduce((acc, b) => acc + b.quantity_reserved, 0);
  const totalJauge = billetsInitiaux.reduce((acc, b) => acc + (b.quantity_total ?? 0), 0);
  const totalRecettesVente = billetsInitiaux.reduce(
    (acc, b) => acc + b.quantity_sold * b.price,
    0,
  );

  function ouvrirEdition(b: TypeBilletAdmin) {
    setBilletEnEdition(b);
    setNom(b.name);
    setDescription(b.description ?? "");
    setPrix(b.price);
    setJaugeTotale(b.quantity_total);
    setMaxParCommande(b.max_per_order ?? 10);
    setEstActif(b.is_active);
    setErreur(null);
    setSucces(null);
  }

  async function enregistrerBillet(e: React.FormEvent) {
    e.preventDefault();
    if (!billetEnEdition) return;

    setErreur(null);
    setSucces(null);

    const placesEngagees = billetEnEdition.quantity_sold + billetEnEdition.quantity_reserved;
    if (jaugeTotale !== null && jaugeTotale < placesEngagees) {
      setErreur(
        `Impossible : ${placesEngagees} place(s) sont déjà engagées (${billetEnEdition.quantity_sold} vendues + ${billetEnEdition.quantity_reserved} réservées). La jauge ne peut être inférieure.`,
      );
      return;
    }

    const donnees = {
      name: nom.trim(),
      description: description.trim() || null,
      price: Math.max(0, Number(prix)),
      quantity_total: jaugeTotale !== null ? Math.max(0, Number(jaugeTotale)) : null,
      max_per_order: Math.max(1, Number(maxParCommande)),
      is_active: estActif,
    };

    const res = await modifierTypeBillet(billetEnEdition.id, donnees);
    if (res.erreur) {
      setErreur(res.erreur);
    } else {
      setSucces(res.succes ?? "Jauge et tarif mis à jour avec succès.");
      setBilletEnEdition(null);
      startTransition(() => {
        router.refresh();
      });
    }
  }

  return (
    <div className="space-y-6">
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

      {/* Cartes recapitulatives globales */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-surface border border-bordure bg-surface p-4 shadow-sm">
          <span className="text-xs font-semibold text-discret uppercase">Billets vendus</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-[#11953f] tabular-nums">
              {totalBilletsVendus}
            </span>
            {totalJauge > 0 ? (
              <span className="text-xs text-discret">
                sur {totalJauge} places ({Math.round((totalBilletsVendus / totalJauge) * 100)}%)
              </span>
            ) : null}
          </div>
        </div>

        <div className="rounded-surface border border-bordure bg-surface p-4 shadow-sm">
          <span className="text-xs font-semibold text-discret uppercase">Places réservées</span>
          <div className="mt-1 text-2xl font-bold text-amber-500 tabular-nums">
            {totalBilletsReserves}
          </div>
          <p className="text-[11px] text-discret mt-0.5">En cours de confirmation</p>
        </div>

        <div className="rounded-surface border border-bordure bg-surface p-4 shadow-sm">
          <span className="text-xs font-semibold text-discret uppercase">Places restantes</span>
          <div className="mt-1 text-2xl font-bold text-fort tabular-nums">
            {totalJauge > 0 ? Math.max(0, totalJauge - totalBilletsVendus - totalBilletsReserves) : "Illimité"}
          </div>
          <p className="text-[11px] text-discret mt-0.5">Disponibles à la vente</p>
        </div>

        <div className="rounded-surface border border-bordure bg-surface p-4 shadow-sm">
          <span className="text-xs font-semibold text-discret uppercase">Recettes billetterie</span>
          <div className="mt-1 text-2xl font-bold text-accent tabular-nums">
            {fcfa(totalRecettesVente)}
          </div>
          <p className="text-[11px] text-discret mt-0.5">Encaissées sur billets payés</p>
        </div>
      </div>

      {/* Liste des categories de billets */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-fort">Jauges par catégorie de billet</h2>

        <div className="grid gap-6 md:grid-cols-3">
          {billetsInitiaux.map((billet) => {
            const jauge = billet.quantity_total ?? 0;
            const engage = billet.quantity_sold + billet.quantity_reserved;
            const tauxVente = jauge > 0 ? Math.min(100, Math.round((billet.quantity_sold / jauge) * 100)) : 0;
            const tauxReserve = jauge > 0 ? Math.min(100 - tauxVente, Math.round((billet.quantity_reserved / jauge) * 100)) : 0;
            const restant = billet.available_quantity ?? (jauge > 0 ? Math.max(0, jauge - engage) : null);

            return (
              <div
                key={billet.id}
                className="flex flex-col justify-between rounded-surface border border-bordure bg-surface p-5 shadow-sm space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs text-discret uppercase">
                        Catégorie #{billet.id}
                      </span>
                      <h3 className="text-lg font-bold text-fort">{billet.name}</h3>
                    </div>

                    <span
                      className={`inline-flex items-center rounded-pilule px-2.5 py-0.5 text-xs font-semibold ${
                        billet.is_active
                          ? billet.is_sold_out
                            ? "bg-[#c70e20]/15 text-[#c70e20]"
                            : "bg-[#11953f]/15 text-[#11953f]"
                          : "bg-discret/15 text-discret"
                      }`}
                    >
                      {billet.is_active ? (billet.is_sold_out ? "Épuisé" : "En vente") : "Inactif"}
                    </span>
                  </div>

                  <div className="mt-3 text-2xl font-bold text-accent tabular-nums">
                    {fcfa(billet.price)}
                  </div>

                  {billet.description ? (
                    <p className="mt-1 text-xs text-discret line-clamp-2">{billet.description}</p>
                  ) : null}

                  {/* Barre de jauge visuelle */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-discret">Remplissage jauge</span>
                      <span className="font-bold text-fort tabular-nums">
                        {billet.quantity_sold} / {jauge > 0 ? jauge : "∞"} ({tauxVente}%)
                      </span>
                    </div>

                    <div className="h-3 w-full overflow-hidden rounded-pilule bg-coque flex border border-bordure">
                      <div
                        style={{ width: `${tauxVente}%` }}
                        className="bg-[#11953f] transition-all duration-300"
                        title={`${billet.quantity_sold} vendus`}
                      />
                      <div
                        style={{ width: `${tauxReserve}%` }}
                        className="bg-amber-400 transition-all duration-300"
                        title={`${billet.quantity_reserved} réservés`}
                      />
                    </div>
                  </div>

                  {/* Details chiffres */}
                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-controle bg-coque p-2.5 text-center text-xs">
                    <div>
                      <span className="block text-[11px] text-discret">Vendus</span>
                      <span className="font-bold text-[#11953f] tabular-nums">
                        {billet.quantity_sold}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[11px] text-discret">Réservés</span>
                      <span className="font-bold text-amber-500 tabular-nums">
                        {billet.quantity_reserved}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[11px] text-discret">Disponibles</span>
                      <span className="font-bold text-fort tabular-nums">
                        {restant !== null ? restant : "Libre"}
                      </span>
                    </div>
                  </div>
                </div>

                {peutGerer ? (
                  <button
                    type="button"
                    onClick={() => ouvrirEdition(billet)}
                    className="w-full rounded-controle border border-bordure bg-appui py-2 text-xs font-semibold text-fort hover:bg-bordure transition-colors"
                  >
                    Modifier jauge & tarif
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal d'edition de jauge */}
      {billetEnEdition ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={enregistrerBillet}
            className="w-full max-w-md rounded-surface border border-bordure bg-surface p-6 shadow-xl space-y-4"
          >
            <div className="flex items-start justify-between border-b border-bordure pb-3">
              <div>
                <h3 className="text-lg font-bold text-fort">
                  Billet : {billetEnEdition.name}
                </h3>
                <p className="text-xs text-discret">
                  Ajustez la jauge globale de places et le prix unitaire.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBilletEnEdition(null)}
                className="text-discret hover:text-fort text-xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label htmlFor="billet-nom" className="block font-semibold text-texte mb-1">
                  Intitulé du billet
                </label>
                <input
                  id="billet-nom"
                  type="text"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  required
                  className="w-full rounded-controle border border-bordure bg-fond px-3 py-2 text-sm text-texte focus:border-accent focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="billet-prix" className="block font-semibold text-texte mb-1">
                    Prix de la place (FCFA)
                  </label>
                  <input
                    id="billet-prix"
                    type="number"
                    min="0"
                    step="500"
                    value={prix}
                    onChange={(e) => setPrix(Number(e.target.value))}
                    required
                    className="w-full rounded-controle border border-bordure bg-fond px-3 py-2 text-sm text-texte focus:border-accent focus:outline-none tabular-nums"
                  />
                </div>

                <div>
                  <label htmlFor="billet-jauge" className="block font-semibold text-texte mb-1">
                    Jauge totale (places)
                  </label>
                  <input
                    id="billet-jauge"
                    type="number"
                    min={billetEnEdition.quantity_sold + billetEnEdition.quantity_reserved}
                    step="1"
                    value={jaugeTotale ?? ""}
                    onChange={(e) => setJaugeTotale(e.target.value ? Number(e.target.value) : null)}
                    placeholder="Illimité si vide"
                    className="w-full rounded-controle border border-bordure bg-fond px-3 py-2 text-sm text-texte focus:border-accent focus:outline-none tabular-nums"
                  />
                  <span className="text-[10px] text-discret block mt-0.5">
                    Min : {billetEnEdition.quantity_sold + billetEnEdition.quantity_reserved} places déjà engagées
                  </span>
                </div>
              </div>

              <div>
                <label htmlFor="billet-max-order" className="block font-semibold text-texte mb-1">
                  Plafond par commande
                </label>
                <input
                  id="billet-max-order"
                  type="number"
                  min="1"
                  max="100"
                  value={maxParCommande}
                  onChange={(e) => setMaxParCommande(Number(e.target.value))}
                  required
                  className="w-full rounded-controle border border-bordure bg-fond px-3 py-2 text-sm text-texte focus:border-accent focus:outline-none tabular-nums"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={estActif}
                  onChange={(e) => setEstActif(e.target.checked)}
                  className="rounded border-bordure text-accent focus:ring-accent"
                />
                <span className="font-semibold text-texte">Activer ce type de billet pour la vente en ligne</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-bordure pt-4">
              <button
                type="button"
                onClick={() => setBilletEnEdition(null)}
                className="rounded-controle border border-bordure px-4 py-2 text-xs font-semibold text-discret hover:bg-appui"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-controle bg-accent px-4 py-2 text-xs font-semibold text-sur-accent hover:bg-accent-survol disabled:opacity-50 transition-colors"
              >
                {isPending ? "Enregistrement..." : "Valider la jauge"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
