"use client";

import { useActionState, useState } from "react";
import { rejeterCandidat, type Retour, validerCandidat } from "@/app/admin/actions";
import { Bouton } from "@/components/ui/Bouton";
import { Zone } from "@/components/ui/Champ";
import type { Candidat } from "@/lib/types";

export function ActionsCandidat({ candidat }: { candidat: Candidat }) {
  const [etatValidation, valider, validationEnCours] = useActionState<Retour, FormData>(
    validerCandidat,
    {},
  );
  const [etatRejet, rejeter, rejetEnCours] = useActionState<Retour, FormData>(
    rejeterCandidat,
    {},
  );
  const [formulaireRejet, setFormulaireRejet] = useState(false);

  const paye = candidat.candidate_number !== null;
  const retour = etatValidation.erreur ?? etatRejet.erreur;
  const succes = etatValidation.succes ?? etatRejet.succes;

  return (
    <div className="rounded-region border border-bordure bg-surface">
      <div className="border-b border-bordure px-4 py-4">
        <h2 className="text-base">Validation</h2>
      </div>

      <div className="px-4 py-4">
        {retour ? (
          <p role="alert" className="mb-4 rounded-region border border-danger bg-danger-fond px-4 py-3 text-sm text-danger">
            {retour}
          </p>
        ) : null}

        {succes ? (
          <p role="status" className="mb-4 rounded-region border border-succes bg-succes-fond px-4 py-3 text-sm text-succes">
            {succes}
          </p>
        ) : null}

        {!paye ? (
          <p className="text-sm text-discret">
            Les frais d’inscription ne sont pas encore encaissés. Un
            dossier ne peut être validé qu’une fois le paiement confirmé.
          </p>
        ) : candidat.status === "active" ? (
          <>
            <p className="text-sm text-discret">
              Ce candidat est validé. Sa page est visible du public.
            </p>
            {!formulaireRejet ? (
              <Bouton
                ton="danger"
                taille="petit"
                onClick={() => setFormulaireRejet(true)}
                className="mt-4"
              >
                Rejeter malgré tout
              </Bouton>
            ) : null}
          </>
        ) : candidat.status === "rejected" ? (
          <>
            <p className="text-sm text-discret">
              Dossier rejeté
              {candidat.rejection_reason ? ` : ${candidat.rejection_reason}` : "."}
            </p>
            <form action={valider} className="mt-4">
              <input type="hidden" name="id" value={candidat.id} />
              <Bouton
                type="submit"
                taille="petit"
                chargement={validationEnCours}
                disabled={validationEnCours}
              >
                {validationEnCours ? "Validation…" : "Revenir sur le rejet"}
              </Bouton>
            </form>
          </>
        ) : (
          <div className="grid gap-4">
            <form action={valider}>
              <input type="hidden" name="id" value={candidat.id} />
              <Bouton
                type="submit"
                taille="grand"
                chargement={validationEnCours}
                disabled={validationEnCours}
                className="w-full"
              >
                {validationEnCours ? "Validation…" : "Valider le candidat"}
              </Bouton>
            </form>

            {!formulaireRejet ? (
              <Bouton ton="danger" onClick={() => setFormulaireRejet(true)}>
                Rejeter le dossier
              </Bouton>
            ) : null}
          </div>
        )}

        {formulaireRejet ? (
          <form action={rejeter} className="mt-4 border-t border-bordure pt-4">
            <input type="hidden" name="id" value={candidat.id} />
            <label htmlFor="reason" className="block text-sm font-semibold text-fort">
              Motif du rejet
            </label>
            <p className="mt-1 text-sm text-discret">
              Le candidat doit pouvoir comprendre la décision.
            </p>
            <Zone
              id="reason"
              name="reason"
              required
              maxLength={255}
              rows={3}
              className="mt-2"
              placeholder="Dossier incomplet, hors catégorie, pièce manquante…"
            />
            <div className="mt-4 flex gap-2">
              <Bouton
                type="submit"
                ton="danger"
                chargement={rejetEnCours}
                disabled={rejetEnCours}
              >
                {rejetEnCours ? "Rejet…" : "Rejeter le dossier"}
              </Bouton>
              <Bouton
                type="button"
                ton="secondaire"
                onClick={() => setFormulaireRejet(false)}
              >
                Annuler
              </Bouton>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
