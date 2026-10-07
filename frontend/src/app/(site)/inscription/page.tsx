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
    <div className="bg-paper text-ink">
      <div className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
        <header className="prose-etroit">
          <h1 className="font-display text-display font-extrabold">
            Inscrire mon talent
          </h1>
          <p className="mt-5 text-lg text-paper-soft">
            Comptez cinq minutes. Votre dossier est enregistré dès l&apos;envoi,
            et le paiement des frais se fait depuis votre téléphone.
          </p>
        </header>

        <div className="mt-14">
          {injoignable ? (
            <div
              role="alert"
              className="panneau border-l-2 border-oxblood bg-oxblood-wash px-6 py-5"
            >
              <h2 className="font-display text-lg font-extrabold text-oxblood">
                Les inscriptions ne sont pas joignables
              </h2>
              <p className="prose-etroit mt-2 text-sm text-ink">
                Le serveur ne répond pas pour le moment. Réessayez dans
                quelques minutes.
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
