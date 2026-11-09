import type { Metadata } from "next";
import { FormulaireInscription } from "@/components/FormulaireInscription";
import { lirePublic } from "@/lib/api";
import type { Categorie } from "@/lib/types";

export const metadata: Metadata = {
  title: "Inscription",
  description:
    "Inscrivez votre talent au concours ArtVibeCamer. Choisissez votre discipline et réglez vos frais par Mobile Money.",
};

export default async function PageInscription({
  searchParams,
}: {
  searchParams: Promise<{ categorie?: string }>;
}) {
  const { categorie } = await searchParams;

  let categories: Categorie[] = [];
  let injoignable = false;

  try {
    const reponse = await lirePublic<{ data: Categorie[] }>("/categories");
    categories = reponse.data;
  } catch {
    injoignable = true;
  }

  return (
    <div className="terrain-clair">
      <div className="cadre py-12 md:py-16">
        <header className="max-w-2xl">
          <h1 className="text-6xl tracking-affiche">Inscrire mon talent</h1>
          <p className="mt-4 text-lg">
            Comptez cinq minutes. Votre dossier est enregistré dès l’envoi,
            et les frais se paient depuis votre téléphone.
          </p>
        </header>

        <div className="mt-12">
          {injoignable ? (
            <div
              role="alert"
              className="max-w-xl rounded-region border border-danger bg-danger-fond px-4 py-3"
            >
              <h2 className="text-base text-danger">Le formulaire ne répond pas</h2>
              <p className="mt-1 text-sm text-fort">
                Le serveur des inscriptions est injoignable. Rechargez la page
                dans quelques minutes.
              </p>
            </div>
          ) : (
            <FormulaireInscription
              categories={categories}
              slugInitial={categorie}
            />
          )}
        </div>
      </div>
    </div>
  );
}
