import type { ComponentProps, ReactNode } from "react";

/*
 * Un champ = une etiquette lisible, le controle, et au besoin une aide ou une
 * erreur. L'erreur dit ce qui s'est passe et comment le corriger ; elle ne
 * s'excuse pas et ne reste pas vague.
 *
 * Seuls les champs facultatifs sont marques : un formulaire d'inscription en
 * compte moins que d'obligatoires, et l'attribut `required` informe deja les
 * lecteurs d'ecran.
 */

const controle =
  "w-full rounded-controle border bg-surface px-3 text-base text-fort " +
  "placeholder:text-discret transition-colors " +
  "focus:border-focus disabled:cursor-not-allowed disabled:bg-appui disabled:opacity-60";

function bordure(erreur?: string) {
  return erreur ? "border-danger" : "border-bordure-forte hover:border-fort";
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
      <label htmlFor={pour} className="block text-sm font-semibold text-fort">
        {etiquette}
        {obligatoire ? null : (
          <span className="ml-2 font-normal text-discret">facultatif</span>
        )}
      </label>

      <div className="mt-2">{children}</div>

      {erreur ? (
        <p id={`${pour}-erreur`} className="mt-2 text-sm text-danger">
          {erreur}
        </p>
      ) : aide ? (
        <p id={`${pour}-aide`} className="mt-2 text-sm text-discret">
          {aide}
        </p>
      ) : null}
    </div>
  );
}

/** Relie le controle a son message d'erreur, rendu par `Champ`. Un appelant peut le remplacer. */
function decrit(id: string | undefined, erreur?: string) {
  return id && erreur ? `${id}-erreur` : undefined;
}

export function Saisie({
  erreur,
  className = "",
  ...props
}: ComponentProps<"input"> & { erreur?: string }) {
  return (
    <input
      aria-invalid={erreur ? true : undefined}
      aria-describedby={decrit(props.id, erreur)}
      {...props}
      className={`${controle} h-10 ${bordure(erreur)} ${className}`}
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
      aria-invalid={erreur ? true : undefined}
      aria-describedby={decrit(props.id, erreur)}
      {...props}
      className={`${controle} h-10 ${bordure(erreur)} ${className}`}
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
      aria-invalid={erreur ? true : undefined}
      aria-describedby={decrit(props.id, erreur)}
      {...props}
      className={`${controle} min-h-28 resize-y py-2 ${bordure(erreur)} ${className}`}
    />
  );
}

/**
 * Selecteur de fichier.
 *
 * Le controle natif est masque et pilote depuis le label : le texte
 * « Choose File » vient du navigateur et n'est pas traduisible, ce qui
 * jurerait sur un formulaire entierement en francais.
 *
 * Rayons concentriques : cadre a 8 px, rembourrage de 4, bouton interieur
 * a 8 − 4 = 4 px.
 */
export function ChampFichier({
  id,
  name,
  fichier,
  onFichier,
  libelle = "Choisir une photo",
  vide = "Aucune photo choisie",
}: {
  id: string;
  name: string;
  fichier: string | null;
  onFichier: (nom: string | null) => void;
  libelle?: string;
  vide?: string;
}) {
  return (
    <div className="flex h-10 items-center gap-3 rounded-controle border border-bordure-forte bg-surface p-1 transition-colors focus-within:border-focus">
      <label
        htmlFor={id}
        className="appui flex h-8 shrink-0 cursor-pointer items-center rounded-enfant bg-appui px-3 text-sm font-semibold whitespace-nowrap text-fort hover:bg-bordure"
      >
        {libelle}
      </label>
      <span className="min-w-0 truncate text-sm text-discret" title={fichier ?? undefined}>
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
    <fieldset className="border-t border-bordure pt-8">
      <legend className="sr-only">{titre}</legend>
      <h2 className="text-xl">{titre}</h2>
      {description ? (
        <p className="mt-1 max-w-xl text-sm text-discret">{description}</p>
      ) : null}
      <div className="mt-6 grid gap-6">{children}</div>
    </fieldset>
  );
}
