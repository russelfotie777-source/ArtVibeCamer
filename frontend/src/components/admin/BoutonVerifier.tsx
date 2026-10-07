"use client";

import { useActionState } from "react";
import { type Retour, verifierPaiement } from "@/app/admin/actions";
import { Bouton } from "@/components/ui/Bouton";

/*
 * Verification d'un paiement aupres de l'operateur. C'est la reponse a un
 * candidat qui affirme avoir ete debite : on redemande l'etat reel plutot que
 * de valider a la main.
 */
export function BoutonVerifier({ reference }: { reference: string }) {
  const [etat, action, enCours] = useActionState<Retour, FormData>(
    verifierPaiement,
    {},
  );

  return (
    <form action={action} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="reference" value={reference} />
      <Bouton type="submit" ton="contour" taille="petit" disabled={enCours}>
        {enCours ? "Vérification" : "Vérifier"}
      </Bouton>

      {etat.succes ? (
        <span role="status" className="text-xs text-sage">
          {etat.succes}
        </span>
      ) : null}
      {etat.erreur ? (
        <span role="alert" className="text-xs text-oxblood">
          {etat.erreur}
        </span>
      ) : null}
    </form>
  );
}
