"use client";

import { seDeconnecter } from "@/app/admin/actions";

export function BoutonDeconnexion() {
  return (
    <form action={seDeconnecter}>
      <button
        type="submit"
        className="appui h-8 rounded-controle px-3 text-sm text-discret hover:bg-appui hover:text-fort"
      >
        Se déconnecter
      </button>
    </form>
  );
}
