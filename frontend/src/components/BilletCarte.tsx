import Image from "next/image";
import type { BilletIndividuel } from "@/lib/types";

// Carte d'un billet individuel avec son QR code d'acces,
// son code de secours dictable et ses mentions de securite.
// Concu pour le scan sur ecran nocturne et pour l'impression papier.
export function BilletCarte({
  billet,
  qrDataUrl,
  nomAcheteur,
  nomEvenement,
  lieu,
  dateEvenement,
}: {
  billet: BilletIndividuel;
  qrDataUrl: string | null;
  nomAcheteur: string;
  nomEvenement?: string;
  lieu?: string | null;
  dateEvenement?: string | null;
}) {
  const estUtilise = billet.status === "used";

  const typeNom = billet.type?.name ?? "Billet Officiel";
  const estVip = typeNom.toLowerCase().includes("vip");

  return (
    <article className="break-inside-avoid overflow-hidden rounded-region border-2 border-bordure bg-surface text-fort shadow-sm print:border-black print:bg-white print:text-black print:shadow-none">
      {/* En-tete du billet */}
      <div
        className={`flex items-center justify-between border-b px-6 py-4 ${
          estVip
            ? "border-accent/40 bg-accent/10 print:border-black print:bg-transparent"
            : "border-bordure bg-appui print:border-black print:bg-transparent"
        }`}
      >
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-accent print:text-black">
            ArtVibeCamer
          </span>
          <h3 className="text-xl font-bold tracking-affiche">{typeNom}</h3>
        </div>

        <span
          className={`rounded-pilule px-3 py-1 text-xs font-semibold ${
            estUtilise
              ? "bg-danger-fond text-danger print:border print:border-black print:text-black"
              : "bg-succes-fond text-succes print:border print:border-black print:text-black"
          }`}
        >
          {estUtilise ? "Entrée déjà scannée" : "Valide pour 1 entrée"}
        </span>
      </div>

      {/* Corps du billet */}
      <div className="grid gap-6 p-6 sm:grid-cols-[1fr_auto] sm:items-center">
        {/* Informations porteur et evenement */}
        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-discret print:text-neutral-600">
              Porteur du billet
            </p>
            <p className="mt-0.5 text-lg font-semibold text-fort print:text-black">
              {billet.holder_name || nomAcheteur}
            </p>
          </div>

          {nomEvenement ? (
            <div>
              <p className="text-xs uppercase tracking-wider text-discret print:text-neutral-600">
                Événement
              </p>
              <p className="mt-0.5 text-sm font-medium text-fort print:text-black">
                {nomEvenement}
              </p>
            </div>
          ) : null}

          {lieu || dateEvenement ? (
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-discret print:text-neutral-700">
              {dateEvenement ? (
                <div>
                  <span className="text-xs uppercase tracking-wider block">Date</span>
                  <span className="font-medium text-fort print:text-black">{dateEvenement}</span>
                </div>
              ) : null}

              {lieu ? (
                <div>
                  <span className="text-xs uppercase tracking-wider block">Lieu</span>
                  <span className="font-medium text-fort print:text-black">{lieu}</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Bloc QR Code et code dictable */}
        <div className="flex flex-col items-center justify-center rounded-region border border-bordure bg-white p-4 text-center print:border-black">
          {qrDataUrl ? (
            <div className="relative size-44 overflow-hidden">
              <Image
                src={qrDataUrl}
                alt={`QR Code pour le billet ${billet.code}`}
                width={176}
                height={176}
                className="size-full object-contain"
                unoptimized
              />
            </div>
          ) : (
            <div className="flex size-44 items-center justify-center bg-neutral-100 text-xs text-neutral-500">
              QR Code disponible une fois payé
            </div>
          )}

          {/* Code dictable court de secours */}
          <div className="mt-3">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
              Code de secours
            </span>
            <p className="chiffre font-mono text-base font-bold tracking-widest text-neutral-900">
              {billet.code}
            </p>
            <p className="mt-0.5 text-[10px] text-neutral-500">
              À dicter si l’écran ne peut pas être scanné
            </p>
          </div>
        </div>
      </div>

      {/* Ligne pointillee de decoupe pour version papier */}
      <div className="border-t-2 border-dashed border-bordure px-6 py-3 bg-coque/40 text-[11px] text-discret flex justify-between items-center print:border-black print:bg-white print:text-neutral-600">
        <span>Billet officiel infalsifiable — Présentation obligatoire au contrôle</span>
        <span className="chiffre font-mono">{billet.code}</span>
      </div>
    </article>
  );
}
