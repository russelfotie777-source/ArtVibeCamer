"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { modifierCategorie } from "@/app/admin/actions";
import { fcfa } from "@/lib/format";
import type { CategorieAdmin } from "@/lib/types";

export function GestionCategories({
  categoriesInitiales,
  peutGerer,
}: {
  categoriesInitiales: CategorieAdmin[];
  peutGerer: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [categorieEnEdition, setCategorieEnEdition] = useState<CategorieAdmin | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  // Valeurs du formulaire en edition
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [tarifIndividuel, setTarifIndividuel] = useState(0);
  const [tarifGroupe, setTarifGroupe] = useState<number | null>(null);
  const [autoriseGroupe, setAutoriseGroupe] = useState(false);
  const [prixVoix, setPrixVoix] = useState(0);
  const [clotureInscriptions, setClotureInscriptions] = useState("");
  const [clotureVotes, setClotureVotes] = useState("");
  const [estActif, setEstActif] = useState(true);

  function ouvrirEdition(cat: CategorieAdmin) {
    setCategorieEnEdition(cat);
    setNom(cat.name);
    setDescription(cat.description ?? "");
    setTarifIndividuel(cat.registration_fee);
    setTarifGroupe(cat.group_fee);
    setAutoriseGroupe(cat.allows_group);
    setPrixVoix(cat.vote_price);
    // Convertir format ISO vers datetime-local (YYYY-MM-DDTHH:mm)
    setClotureInscriptions(cat.registration_closes_at ? cat.registration_closes_at.slice(0, 16) : "");
    setClotureVotes(cat.voting_closes_at ? cat.voting_closes_at.slice(0, 16) : "");
    setEstActif(cat.is_active);
    setErreur(null);
    setSucces(null);
  }

  async function enregistrerModifications(e: React.FormEvent) {
    e.preventDefault();
    if (!categorieEnEdition) return;

    setErreur(null);
    setSucces(null);

    const donnees = {
      name: nom.trim(),
      description: description.trim() || null,
      registration_fee: Math.max(0, Number(tarifIndividuel)),
      group_fee: autoriseGroupe ? Math.max(0, Number(tarifGroupe ?? tarifIndividuel)) : null,
      vote_price: Math.max(1, Number(prixVoix)),
      registration_closes_at: clotureInscriptions ? new Date(clotureInscriptions).toISOString() : null,
      voting_closes_at: clotureVotes ? new Date(clotureVotes).toISOString() : null,
      is_active: estActif,
    };

    const res = await modifierCategorie(categorieEnEdition.id, donnees);
    if (res.erreur) {
      setErreur(res.erreur);
    } else {
      setSucces(res.succes ?? "Catégorie mise à jour avec succès.");
      setCategorieEnEdition(null);
      startTransition(() => {
        router.refresh();
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Messages de statut */}
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

      {/* Grille des categories */}
      <div className="grid gap-6 md:grid-cols-2">
        {categoriesInitiales.map((cat) => {
          return (
            <div
              key={cat.id}
              className="flex flex-col justify-between rounded-surface border border-bordure bg-surface p-5 shadow-sm space-y-4"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="font-mono text-xs text-discret uppercase">
                      ID #{cat.id}
                    </span>
                    <h2 className="text-xl font-bold text-fort">{cat.name}</h2>
                    {cat.tagline ? (
                      <p className="text-xs text-accent font-medium mt-0.5">{cat.tagline}</p>
                    ) : null}
                  </div>

                  <span
                    className={`inline-flex items-center rounded-pilule px-2.5 py-0.5 text-xs font-semibold ${
                      cat.is_active
                        ? "bg-[#11953f]/15 text-[#11953f]"
                        : "bg-discret/15 text-discret"
                    }`}
                  >
                    {cat.is_active ? "Active" : "Désactivée"}
                  </span>
                </div>

                {cat.description ? (
                  <p className="mt-3 text-xs text-discret line-clamp-2">
                    {cat.description}
                  </p>
                ) : null}

                {/* Blocs indicateurs de tarifs */}
                <div className="mt-4 grid grid-cols-3 gap-2 rounded-controle bg-coque p-3 text-center">
                  <div>
                    <span className="block text-[11px] text-discret font-medium">Individuel</span>
                    <span className="text-sm font-bold text-fort tabular-nums">
                      {fcfa(cat.registration_fee)}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[11px] text-discret font-medium">Groupe</span>
                    <span className="text-sm font-bold text-fort tabular-nums">
                      {cat.allows_group && cat.group_fee !== null ? fcfa(cat.group_fee) : "Non autorisé"}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[11px] text-discret font-medium">Prix voix</span>
                    <span className="text-sm font-bold text-accent tabular-nums">
                      {fcfa(cat.vote_price)}
                    </span>
                  </div>
                </div>

                {/* Echeances et jauges */}
                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex justify-between border-b border-bordure pb-1.5">
                    <span className="text-discret">Clôture inscriptions :</span>
                    <span className="font-semibold text-texte">
                      {cat.registration_closes_at
                        ? new Date(cat.registration_closes_at).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Illimitée"}
                    </span>
                  </div>

                  <div className="flex justify-between border-b border-bordure pb-1.5">
                    <span className="text-discret">Clôture votes :</span>
                    <span className="font-semibold text-texte">
                      {cat.voting_closes_at
                        ? new Date(cat.voting_closes_at).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Illimitée"}
                    </span>
                  </div>

                  <div className="flex justify-between pt-0.5">
                    <span className="text-discret">Candidats / Voix :</span>
                    <span className="font-semibold text-texte tabular-nums">
                      {cat.candidates_count} candidat(s) · {cat.votes_count} voix
                    </span>
                  </div>
                </div>
              </div>

              {peutGerer ? (
                <button
                  type="button"
                  onClick={() => ouvrirEdition(cat)}
                  className="w-full rounded-controle border border-bordure bg-appui py-2 text-xs font-semibold text-fort hover:bg-bordure transition-colors"
                >
                  Modifier tarifs & dates
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Modal d'edition */}
      {categorieEnEdition ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={enregistrerModifications}
            className="w-full max-w-lg rounded-surface border border-bordure bg-surface p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between border-b border-bordure pb-3">
              <div>
                <h3 className="text-lg font-bold text-fort">
                  Modifier : {categorieEnEdition.name}
                </h3>
                <p className="text-xs text-discret">
                  Ajustez les tarifs d’accès et les fenêtres temporelles du concours.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCategorieEnEdition(null)}
                className="text-discret hover:text-fort text-xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label htmlFor="cat-nom" className="block font-semibold text-texte mb-1">
                  Nom de la discipline
                </label>
                <input
                  id="cat-nom"
                  type="text"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  required
                  className="w-full rounded-controle border border-bordure bg-fond px-3 py-2 text-sm text-texte focus:border-accent focus:outline-none"
                />
              </div>

              {/* Tarifs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cat-fee" className="block font-semibold text-texte mb-1">
                    Frais individuel (FCFA)
                  </label>
                  <input
                    id="cat-fee"
                    type="number"
                    min="0"
                    step="500"
                    value={tarifIndividuel}
                    onChange={(e) => setTarifIndividuel(Number(e.target.value))}
                    required
                    className="w-full rounded-controle border border-bordure bg-fond px-3 py-2 text-sm text-texte focus:border-accent focus:outline-none tabular-nums"
                  />
                </div>

                <div>
                  <label htmlFor="cat-vote-price" className="block font-semibold text-texte mb-1">
                    Prix de la voix (FCFA)
                  </label>
                  <input
                    id="cat-vote-price"
                    type="number"
                    min="1"
                    step="50"
                    value={prixVoix}
                    onChange={(e) => setPrixVoix(Number(e.target.value))}
                    required
                    className="w-full rounded-controle border border-bordure bg-fond px-3 py-2 text-sm text-texte focus:border-accent focus:outline-none tabular-nums"
                  />
                </div>
              </div>

              {/* Formule de groupe */}
              <div className="rounded-controle border border-bordure bg-coque p-3 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-texte">
                  <input
                    type="checkbox"
                    checked={autoriseGroupe}
                    onChange={(e) => setAutoriseGroupe(e.target.checked)}
                    className="rounded border-bordure text-accent focus:ring-accent"
                  />
                  <span>Autoriser les inscriptions en groupe</span>
                </label>

                {autoriseGroupe ? (
                  <div className="pt-1">
                    <label htmlFor="cat-group-fee" className="block font-medium text-discret mb-1">
                      Tarif forfaitaire de groupe (FCFA)
                    </label>
                    <input
                      id="cat-group-fee"
                      type="number"
                      min="0"
                      step="500"
                      value={tarifGroupe ?? tarifIndividuel}
                      onChange={(e) => setTarifGroupe(Number(e.target.value))}
                      className="w-full rounded-controle border border-bordure bg-fond px-3 py-2 text-sm text-texte focus:border-accent focus:outline-none tabular-nums"
                    />
                  </div>
                ) : null}
              </div>

              {/* Dates de cloture */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="cat-close-reg" className="block font-semibold text-texte mb-1">
                    Clôture inscriptions
                  </label>
                  <input
                    id="cat-close-reg"
                    type="datetime-local"
                    value={clotureInscriptions}
                    onChange={(e) => setClotureInscriptions(e.target.value)}
                    className="w-full rounded-controle border border-bordure bg-fond px-3 py-2 text-xs text-texte focus:border-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="cat-close-vote" className="block font-semibold text-texte mb-1">
                    Clôture votes
                  </label>
                  <input
                    id="cat-close-vote"
                    type="datetime-local"
                    value={clotureVotes}
                    onChange={(e) => setClotureVotes(e.target.value)}
                    className="w-full rounded-controle border border-bordure bg-fond px-3 py-2 text-xs text-texte focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              {/* Interrupteur actif */}
              <label className="flex items-center gap-2 cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={estActif}
                  onChange={(e) => setEstActif(e.target.checked)}
                  className="rounded border-bordure text-accent focus:ring-accent"
                />
                <span className="font-semibold text-texte">Catégorie active et visible sur le site</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-bordure pt-4">
              <button
                type="button"
                onClick={() => setCategorieEnEdition(null)}
                className="rounded-controle border border-bordure px-4 py-2 text-xs font-semibold text-discret hover:bg-appui"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-controle bg-accent px-4 py-2 text-xs font-semibold text-sur-accent hover:bg-accent-survol disabled:opacity-50 transition-colors"
              >
                {isPending ? "Enregistrement..." : "Enregistrer les tarifs"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
