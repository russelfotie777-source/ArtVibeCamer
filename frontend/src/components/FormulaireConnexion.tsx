"use client";

import { useActionState } from "react";
import { seConnecter, type EtatConnexion } from "@/app/connexion/actions";
import { Bouton } from "@/components/ui/Bouton";

export function FormulaireConnexion() {
  const [etat, action, enCours] = useActionState<EtatConnexion, FormData>(
    seConnecter,
    {},
  );

  const bordure = etat.message ? "border-oxblood" : "border-ink-line";

  return (
    <form action={action} className="grid gap-5">
      {etat.message ? (
        <p
          role="alert"
          className="panneau border-l-2 border-oxblood bg-oxblood/15 px-4 py-3 text-sm text-paper"
        >
          {etat.message}
        </p>
      ) : null}

      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className={`controle mt-1.5 w-full border ${bordure} bg-ink-raised px-3 py-2.5 text-base text-paper placeholder:text-ink-soft/60 focus:border-brass focus:outline-none`}
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={`controle mt-1.5 w-full border ${bordure} bg-ink-raised px-3 py-2.5 text-base text-paper focus:border-brass focus:outline-none`}
        />
      </div>

      <Bouton type="submit" taille="grand" disabled={enCours}>
        {enCours ? "Connexion en cours" : "Se connecter"}
      </Bouton>
    </form>
  );
}
