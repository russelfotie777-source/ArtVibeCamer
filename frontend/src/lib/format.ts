/**
 * Formatage pour un public camerounais francophone.
 */

/**
 * Montant en FCFA. Le franc CFA n'a pas de sous-unite : on n'affiche jamais
 * de decimale. Separateur de milliers par espace insecable fine, pour que le
 * montant ne se coupe pas en fin de ligne.
 */
export function fcfa(montant: number): string {
  return `${montant.toLocaleString("fr-FR").replace(/ |\s/g, " ")} FCFA`;
}

/** Montant sans l'unite, pour les tableaux ou la colonne porte deja « FCFA ». */
export function nombre(valeur: number): string {
  return valeur.toLocaleString("fr-FR").replace(/ |\s/g, " ");
}

/** 671 23 45 67 — groupement lisible d'un mobile camerounais. */
export function telephone(valeur: string | null | undefined): string {
  if (!valeur) return "—";
  const chiffres = valeur.replace(/\D/g, "");
  const local = chiffres.startsWith("237") ? chiffres.slice(3) : chiffres;
  if (local.length !== 9) return valeur;
  return `${local.slice(0, 3)} ${local.slice(3, 5)} ${local.slice(5, 7)} ${local.slice(7)}`;
}

export function dateCourte(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function dateHeure(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** « dans 3 jours », « il y a 2 heures » — pour les echeances et les journaux. */
export function dateRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ecart = new Date(iso).getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
  const minutes = Math.round(ecart / 60000);

  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const heures = Math.round(minutes / 60);
  if (Math.abs(heures) < 24) return rtf.format(heures, "hour");
  return rtf.format(Math.round(heures / 24), "day");
}
