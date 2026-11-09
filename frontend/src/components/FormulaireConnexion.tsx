"use client";

import { useActionState } from "react";
import { seConnecter, type EtatConnexion } from "@/app/connexion/actions";
import { Bouton } from "@/components/ui/Bouton";
import { Champ, Saisie } from "@/components/ui/Champ";

export function FormulaireConnexion() {
  const [etat, action, enCours] = useActionState<EtatConnexion, FormData>(
    seConnecter,
    {},
  );

  // Le message ne dit pas lequel des deux champs est faux : les deux le signalent.
  const decrit = etat.message ? "connexion-erreur" : undefined;

  return (
    <form action={action} className="grid gap-6">
      {etat.message ? (
        <p
          id="connexion-erreur"
          role="alert"
          className="rounded-region border border-danger bg-danger-fond px-4 py-3 text-sm font-semibold text-danger"
        >
          {etat.message}
        </p>
      ) : null}

      <Champ etiquette="Email" pour="email" obligatoire>
        <Saisie
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          erreur={etat.message}
          aria-describedby={decrit}
        />
      </Champ>

      <Champ etiquette="Mot de passe" pour="password" obligatoire>
        <Saisie
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          erreur={etat.message}
          aria-describedby={decrit}
        />
      </Champ>

      <Bouton type="submit" taille="grand" chargement={enCours} disabled={enCours}>
        {enCours ? "Connexion…" : "Se connecter"}
      </Bouton>
    </form>
  );
}
