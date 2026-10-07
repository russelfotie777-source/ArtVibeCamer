import type { ComponentProps, ReactNode } from "react";

/*
 * Un champ = une etiquette lisible, le controle, et au besoin une aide ou une
 * erreur. L'erreur dit ce qui s'est passe et comment le corriger ; elle ne
 * s'excuse pas et ne reste pas vague.
 */

const controle =
  "controle w-full border bg-paper-raised px-3 py-2.5 text-base text-ink " +
  "placeholder:text-paper-soft/70 transition-colors " +
  "focus:border-brass focus:outline-none disabled:bg-paper disabled:opacity-60";

function bordure(erreur?: string) {
  return erreur ? "border-oxblood" : "border-rule hover:border-ink/30";
}

export function Champ({
  etiquette,
  pour,
  erreur,
  aide,
  obligatoire,
  children,
  className = "",
}: {
  etiquette: string;
  pour: string;
  erreur?: string;
  aide?: string;
  obligatoire?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={pour} className="block text-sm font-medium text-ink">
        {etiquette}
        {obligatoire ? (
          <span className="ml-1 text-oxblood" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="ml-2 text-xs font-normal text-paper-soft">
            facultatif
          </span>
        )}
      </label>

      <div className="mt-1.5">{children}</div>

      {erreur ? (
        <p id={`${pour}-erreur`} className="mt-1.5 text-sm text-oxblood">
          {erreur}
        </p>
      ) : aide ? (
        <p id={`${pour}-aide`} className="mt-1.5 text-sm text-paper-soft">
          {aide}
        </p>
      ) : null}
    </div>
  );
}

export function Saisie({
  erreur,
  className = "",
  ...props
}: ComponentProps<"input"> & { erreur?: string }) {
  return (
    <input
      {...props}
      aria-invalid={erreur ? true : undefined}
      aria-describedby={erreur ? `${props.id}-erreur` : undefined}
      className={`${controle} ${bordure(erreur)} ${className}`}
    />
  );
}

export function Liste({
  erreur,
  className = "",
  ...props
}: ComponentProps<"select"> & { erreur?: string }) {
  return (
    <select
      {...props}
      aria-invalid={erreur ? true : undefined}
      className={`${controle} ${bordure(erreur)} ${className}`}
    />
  );
}

export function Zone({
  erreur,
  className = "",
  ...props
}: ComponentProps<"textarea"> & { erreur?: string }) {
  return (
    <textarea
      {...props}
      aria-invalid={erreur ? true : undefined}
      className={`${controle} ${bordure(erreur)} min-h-28 resize-y ${className}`}
    />
  );
}

/**
 * Selecteur de fichier.
 *
 * Le controle natif est masque et pilote depuis le label : le texte
 * « Choose File » vient du navigateur et n'est pas traduisible, ce qui
 * jurerait sur un formulaire entierement en francais.
 */
export function ChampFichier({
  id,
  name,
  fichier,
  onFichier,
  libelle = "Choisir une photo",
  vide = "Aucune photo choisie",
  compact = false,
}: {
  id: string;
  name: string;
  fichier: string | null;
  onFichier: (nom: string | null) => void;
  libelle?: string;
  vide?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`controle flex items-center gap-3 border border-rule bg-paper-raised ${compact ? "p-1" : "p-1.5"}`}
    >
      <label
        htmlFor={id}
        className={`controle cursor-pointer border border-ink/20 bg-paper font-medium whitespace-nowrap transition-colors hover:border-ink hover:bg-ink/5 ${compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"}`}
      >
        {libelle}
      </label>
      <span
        className={`min-w-0 truncate text-paper-soft ${compact ? "text-xs" : "text-sm"}`}
      >
        {fichier ?? vide}
      </span>
      <input
        id={id}
        name={name}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => onFichier(e.target.files?.[0]?.name ?? null)}
        className="sr-only"
      />
    </div>
  );
}

/** Regroupement visuel d'une section de formulaire. */
export function Groupe({
  titre,
  description,
  children,
}: {
  titre: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="border-t border-rule pt-7">
      <legend className="sr-only">{titre}</legend>
      <h2 className="font-display text-xl font-extrabold text-ink">{titre}</h2>
      {description ? (
        <p className="prose-etroit mt-1.5 text-sm text-paper-soft">
          {description}
        </p>
      ) : null}
      <div className="mt-6 grid gap-5">{children}</div>
    </fieldset>
  );
}
