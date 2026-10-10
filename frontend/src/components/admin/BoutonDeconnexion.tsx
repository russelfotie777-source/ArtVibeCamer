"use client";

import { seDeconnecter } from "@/app/admin/actions";

export function BoutonDeconnexion() {
  return (
    <form action={seDeconnecter}>
      <button
        type="submit"
        className="controle px-2 py-1 text-xs text-ink-soft transition-colors hover:text-brass"
      >
        Se déconnecter
      </button>
    </form>
  );
}
