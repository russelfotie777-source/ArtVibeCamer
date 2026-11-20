"use client";

import { Bouton } from "@/components/ui/Bouton";

// Bouton client declenchant la boite de dialogue d'impression du navigateur.
export function BoutonImprimer() {
  return (
    <Bouton
      type="button"
      ton="secondaire"
      onClick={() => window.print()}
      className="print:hidden"
    >
      Imprimer les billets
    </Bouton>
  );
}
