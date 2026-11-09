import Link from "next/link";
import type { ComponentProps } from "react";

/*
 * Un libelle de bouton dit exactement ce qui va se passer : « Payer les frais
 * d'inscription », pas « Valider ». Le meme mot est repris dans le message de
 * confirmation.
 *
 * Les tons sont des roles, pas des couleurs : ils prennent les valeurs du
 * terrain (clair ou sombre) qui entoure le bouton.
 */

type Ton = "principal" | "secondaire" | "danger";

const tons: Record<Ton, string> = {
  principal: "bg-accent font-semibold text-sur-accent hover:bg-accent-survol",
  secondaire:
    "border border-bordure-forte text-fort hover:border-fort hover:bg-appui",
  danger:
    "border border-danger text-danger hover:bg-danger hover:text-fond",
};

/*
 * 32, 40 et 48 px de haut ; 12 px de rembourrage, 24 pour l'action d'une
 * page. Hauteurs minimales : un nom de candidat long passe a la ligne au lieu
 * de deborder du bouton.
 */
const tailles = {
  petit: "min-h-8 px-3 py-1 text-sm",
  normal: "min-h-10 px-3 py-2 text-sm",
  grand: "min-h-12 px-6 py-2 text-base",
};

const base =
  "appui inline-flex items-center justify-center gap-2 rounded-controle text-center " +
  "disabled:cursor-not-allowed disabled:opacity-50";

/** Petit indicateur pose devant le libelle pendant un envoi. */
function Indicateur() {
  return (
    <span
      aria-hidden="true"
      className="size-4 shrink-0 animate-spin rounded-pilule border-2 border-current border-r-transparent"
    />
  );
}

export function Bouton({
  ton = "principal",
  taille = "normal",
  chargement = false,
  className = "",
  children,
  ...props
}: ComponentProps<"button"> & {
  ton?: Ton;
  taille?: keyof typeof tailles;
  /** Affiche l'indicateur ; le libelle passe au present continu (« Envoi… »). */
  chargement?: boolean;
}) {
  return (
    <button
      {...props}
      aria-busy={chargement || undefined}
      className={`${base} ${tons[ton]} ${tailles[taille]} ${className}`}
    >
      {chargement ? <Indicateur /> : null}
      {children}
    </button>
  );
}

export function LienBouton({
  ton = "principal",
  taille = "normal",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { ton?: Ton; taille?: keyof typeof tailles }) {
  return (
    <Link
      {...props}
      className={`${base} ${tons[ton]} ${tailles[taille]} ${className}`}
    />
  );
}
