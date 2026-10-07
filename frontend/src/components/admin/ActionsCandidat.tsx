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
    <div className="panneau border border-rule bg-paper-raised">
      <div className="border-b border-rule px-5 py-4">
        <h2 className="font-display text-lg font-extrabold">Validation</h2>
      </div>

      <div className="px-5 py-5">
        {retour ? (
          <p role="alert" className="mb-4 border-l-2 border-oxblood bg-oxblood-wash px-4 py-3 text-sm text-oxblood">
            {retour}
          </p>
        ) : null}

        {succes ? (
          <p role="status" className="mb-4 border-l-2 border-sage bg-sage-wash px-4 py-3 text-sm text-sage">
            {succes}
          </p>
        ) : null}

        {!paye ? (
          <p className="text-sm leading-relaxed text-paper-soft">
            Les frais d&apos;inscription ne sont pas encore encaissés. Un
            dossier ne peut être validé qu&apos;une fois le paiement confirmé.
          </p>
        ) : candidat.status === "active" ? (
          <>
            <p className="text-sm leading-relaxed text-paper-soft">
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
            <p className="text-sm leading-relaxed text-paper-soft">
              Dossier rejeté
              {candidat.rejection_reason ? ` : ${candidat.rejection_reason}` : "."}
            </p>
            <form action={valider} className="mt-4">
              <input type="hidden" name="id" value={candidat.id} />
              <Bouton type="submit" disabled={validationEnCours} taille="petit">
                {validationEnCours ? "Validation" : "Revenir sur le rejet"}
              </Bouton>
            </form>
          </>
        ) : (
          <div className="grid gap-3">
            <form action={valider}>
              <input type="hidden" name="id" value={candidat.id} />
              <Bouton
                type="submit"
                taille="grand"
                disabled={validationEnCours}
                className="w-full"
              >
                {validationEnCours ? "Validation en cours" : "Valider le candidat"}
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
          <form action={rejeter} className="mt-5 border-t border-rule pt-5">
            <input type="hidden" name="id" value={candidat.id} />
            <label htmlFor="reason" className="block text-sm font-medium">
              Motif du rejet
            </label>
            <p className="mt-1 text-xs text-paper-soft">
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
            <div className="mt-3 flex gap-2">
              <Bouton type="submit" ton="danger" disabled={rejetEnCours}>
                {rejetEnCours ? "Rejet en cours" : "Rejeter"}
              </Bouton>
              <Bouton
                type="button"
                ton="contour"
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
