import { Bouton, LienBouton } from "@/components/ui/Bouton";

/*
 * Filtres en formulaire GET : l'etat vit dans l'URL, donc une recherche se
 * partage par lien et survit a un rechargement. Fonctionne aussi sans
 * JavaScript, ce qui compte sur une connexion mobile capricieuse.
 */
export function Filtres({
  children,
  actifs,
  base,
}: {
  children: React.ReactNode;
  actifs: boolean;
  base: string;
}) {
  return (
    <form
      method="get"
      className="panneau mt-7 border border-rule bg-paper-raised px-5 py-4"
    >
      <div className="flex flex-wrap items-end gap-4">
        {children}

        <div className="flex gap-2">
          <Bouton type="submit" ton="indigo" taille="normal">
            Filtrer
          </Bouton>
          {actifs ? (
            <LienBouton href={base} ton="contour" taille="normal">
              Effacer
            </LienBouton>
          ) : null}
        </div>
      </div>
    </form>
  );
}

export function ChampFiltre({
  etiquette,
  pour,
  children,
  large,
}: {
  etiquette: string;
  pour: string;
  children: React.ReactNode;
  large?: boolean;
}) {
  return (
    <div className={large ? "min-w-56 flex-1" : "min-w-40"}>
      <label htmlFor={pour} className="block text-xs text-paper-soft">
        {etiquette}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function Pagination({
  meta,
  construire,
}: {
  meta: { current_page: number; last_page: number; total: number; from: number | null; to: number | null };
  construire: (page: number) => string;
}) {
  if (meta.total === 0) return null;

  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-paper-soft">
        <span className="chiffre">{meta.from ?? 0}</span>–
        <span className="chiffre">{meta.to ?? 0}</span> sur{" "}
        <span className="chiffre">{meta.total}</span>
      </p>

      {meta.last_page > 1 ? (
        <div className="flex gap-2">
          {meta.current_page > 1 ? (
            <LienBouton
              href={construire(meta.current_page - 1)}
              ton="contour"
              taille="petit"
            >
              Précédent
            </LienBouton>
          ) : null}
          <span className="chiffre px-2 py-1.5 text-xs text-paper-soft">
            Page {meta.current_page} / {meta.last_page}
          </span>
          {meta.current_page < meta.last_page ? (
            <LienBouton
              href={construire(meta.current_page + 1)}
              ton="contour"
              taille="petit"
            >
              Suivant
            </LienBouton>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
