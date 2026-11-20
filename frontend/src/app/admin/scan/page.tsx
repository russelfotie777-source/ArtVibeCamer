import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ScannerEntree } from "@/components/admin/ScannerEntree";
import { ErreurApi, lireAdmin } from "@/lib/api";
import type { ReponseStatsScan, Utilisateur } from "@/lib/types";

export const metadata: Metadata = {
  title: "Contrôle d’Accès",
};

// Page de scan et de controle d'entree reservee aux roles scanner, admin et super_admin.
// Verifie les droits via capabilities.scan avant d'autoriser l'ecran.
export default async function PageScan() {
  let utilisateur: Utilisateur;
  let statsInitiales: ReponseStatsScan | null = null;

  try {
    const [reponseMe, reponseStats] = await Promise.all([
      lireAdmin<{ user: Utilisateur }>("/admin/me"),
      lireAdmin<ReponseStatsScan>("/admin/scan/stats").catch(() => null),
    ]);

    utilisateur = reponseMe.user;
    statsInitiales = reponseStats;
  } catch (erreur) {
    if (erreur instanceof ErreurApi && (erreur.estAuthentification || erreur.statut === 403)) {
      redirect("/connexion");
    }
    throw erreur;
  }

  // Seuls les comptes ayant la capacite de scan peuvent acceder a cette interface.
  if (!utilisateur.capabilities.scan) {
    redirect("/admin");
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-bordure pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-affiche text-fort">
            Contrôle d’Accès & Billetterie
          </h1>
          <p className="mt-1 text-sm text-discret">
            Scannez le QR code présenté sur le téléphone ou dictez le code de secours.
          </p>
        </div>

        <div className="text-right text-xs text-discret">
          <p>
            Agent : <span className="font-semibold text-fort">{utilisateur.name}</span>
          </p>
          <p>{utilisateur.role_label}</p>
        </div>
      </header>

      <ScannerEntree statsInitiales={statsInitiales} />
    </div>
  );
}
