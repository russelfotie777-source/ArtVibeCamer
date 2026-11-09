"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const liens = [
  { href: "/admin", libelle: "Tableau de bord" },
  { href: "/admin/candidats", libelle: "Candidats" },
  { href: "/admin/paiements", libelle: "Paiements" },
];

export function NavAdmin() {
  const chemin = usePathname();

  return (
    <nav aria-label="Back-office">
      <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
        {liens.map((lien) => {
          const actif =
            lien.href === "/admin"
              ? chemin === "/admin"
              : chemin.startsWith(lien.href);

          return (
            <li key={lien.href}>
              <Link
                href={lien.href}
                aria-current={actif ? "page" : undefined}
                /*
                 * L'etat actif est porte par un filet or et un fond, pas par
                 * la seule couleur du texte : lisible meme sur un ecran delave
                 * de telephone en plein jour.
                 */
                className={`relative flex h-10 items-center rounded-controle px-3 text-sm whitespace-nowrap transition-colors duration-100 ${
                  actif
                    ? "bg-appui font-semibold text-fort before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-pilule before:bg-accent"
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
