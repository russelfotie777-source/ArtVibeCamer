"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Utilisateur } from "@/lib/types";

const tousLesLiens = [
  { href: "/admin", libelle: "Tableau de bord", backOfficeOnly: true },
  { href: "/admin/candidats", libelle: "Candidats", backOfficeOnly: true },
  { href: "/admin/paiements", libelle: "Paiements", backOfficeOnly: true },
  { href: "/admin/scan", libelle: "Contrôle d’accès", scanOnly: true },
];

// Navigation du back-office : filtre les liens selon les capacites de l'utilisateur.
export function NavAdmin({ utilisateur }: { utilisateur?: Utilisateur | null }) {
  const chemin = usePathname();

  const liens = tousLesLiens.filter((lien) => {
    if (lien.backOfficeOnly && utilisateur && !utilisateur.capabilities.back_office) {
      return false;
    }
    if (lien.scanOnly && utilisateur && !utilisateur.capabilities.scan) {
      return false;
    }
    return true;
  });

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
