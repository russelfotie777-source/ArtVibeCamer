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
    <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0.5 lg:overflow-visible">
      {liens.map((lien) => {
        const actif =
          lien.href === "/admin"
            ? chemin === "/admin"
            : chemin.startsWith(lien.href);

        return (
          <Link
            key={lien.href}
            href={lien.href}
            aria-current={actif ? "page" : undefined}
            /*
             * L'etat actif est porte par un filet lateral et un fond, pas par
             * la seule couleur du texte : lisible meme sur un ecran delave de
             * telephone en plein jour.
             */
            className={`controle border-l-2 px-4 py-2.5 text-sm whitespace-nowrap transition-colors ${
              actif
                ? "border-brass bg-ink-raised font-medium text-paper"
                : "border-transparent text-ink-soft hover:border-ink-line hover:text-paper"
            }`}
          >
            {lien.libelle}
          </Link>
        );
      })}
    </nav>
  );
}
