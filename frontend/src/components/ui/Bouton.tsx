import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/*
 * Un libelle de bouton dit exactement ce qui va se passer : « Payer les frais
 * d'inscription », pas « Valider ». Le meme mot est repris dans le message de
 * confirmation.
 */

type Ton = "laiton" | "indigo" | "contour" | "contour-clair" | "danger";

const tons: Record<Ton, string> = {
  laiton:
    "bg-brass text-ink hover:bg-brass-lift border border-brass hover:border-brass-lift",
  indigo:
    "bg-ink text-paper hover:bg-ink-raised border border-ink",
  contour:
    "bg-transparent text-ink border border-ink/25 hover:border-ink hover:bg-ink/5",
  "contour-clair":
    "bg-transparent text-paper border border-ink-soft/40 hover:border-brass hover:text-brass",
  danger:
    "bg-transparent text-oxblood border border-oxblood/35 hover:bg-oxblood hover:text-paper hover:border-oxblood",
};

const tailles = {
  normal: "px-5 py-2.5 text-sm",
  grand: "px-7 py-3.5 text-base",
  petit: "px-3 py-1.5 text-xs",
};

const base =
  "controle inline-flex items-center justify-center gap-2 font-medium transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-45";

export function Bouton({
  ton = "laiton",
  taille = "normal",
  className = "",
  ...props
}: ComponentProps<"button"> & { ton?: Ton; taille?: keyof typeof tailles }) {
  return (
    <button
      {...props}
      className={`${base} ${tons[ton]} ${tailles[taille]} ${className}`}
    />
  );
}

export function LienBouton({
  ton = "laiton",
  taille = "normal",
  className = "",
  children,
  href,
}: {
  ton?: Ton;
  taille?: keyof typeof tailles;
  className?: string;
  children: ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`${base} ${tons[ton]} ${tailles[taille]} ${className}`}
    >
      {children}
    </Link>
  );
}
