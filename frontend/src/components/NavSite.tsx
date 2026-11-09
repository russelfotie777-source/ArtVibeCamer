"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const liens = [
  { href: "/candidats", libelle: "Candidats", toujours: true },
  { href: "/inscription", libelle: "S’inscrire", toujours: true },
  // Reserve a l'equipe : il cede sa place sur telephone, ou le logo et les
  // deux liens publics remplissent deja la largeur.
  { href: "/admin", libelle: "Organisation", toujours: false },
];

export function NavSite() {
  const chemin = usePathname();

  return (
    <nav aria-label="Navigation principale">
      {/* Retrait du rembourrage du dernier lien : son texte tombe sur le bord du contenu. */}
      <ul className="-mr-3 flex items-center gap-1">
        {liens.map((lien) => {
          const actif = chemin.startsWith(lien.href);

          return (
            <li key={lien.href} className={lien.toujours ? undefined : "hidden sm:block"}>
              <Link
                href={lien.href}
                aria-current={actif ? "page" : undefined}
                className={`block rounded-controle px-3 py-2 text-sm transition-colors ${
                  actif
                    ? "bg-appui text-fort"
                    : "text-discret hover:bg-appui hover:text-fort"
                }`}
              >
                {lien.libelle}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
