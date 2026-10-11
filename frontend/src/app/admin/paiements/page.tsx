import { ChampFiltre, Filtres, Pagination } from "@/components/admin/Filtres";
import { BoutonVerifier } from "@/components/admin/BoutonVerifier";
import { Liste, Saisie } from "@/components/ui/Champ";
import { StatutTransactionBadge } from "@/components/ui/Statut";
import { lireAdmin, parametres } from "@/lib/api";
import { dateHeure, fcfa, nombre, telephone } from "@/lib/format";
import type { Page, Transaction } from "@/lib/types";

export const metadata = { title: "Paiements" };

const types = [
  { valeur: "", libelle: "Tous les flux" },
  { valeur: "registration", libelle: "Inscriptions" },
  { valeur: "vote", libelle: "Votes" },
  { valeur: "ticket", libelle: "Billets" },
];

const statuts = [
  { valeur: "", libelle: "Tous les statuts" },
  { valeur: "succeeded", libelle: "Payés" },
  { valeur: "processing", libelle: "En cours" },
  { valeur: "pending", libelle: "En attente" },
  { valeur: "failed", libelle: "Échoués" },
  { valeur: "expired", libelle: "Expirés" },
];

export default async function PagePaiements({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const filtres = await searchParams;

  const liste = await lireAdmin<Page<Transaction>>(
    `/admin/transactions${parametres({
      type: filtres.type,
      status: filtres.status,
      search: filtres.search,
      page: filtres.page,
      per_page: 25,
    })}`,
  );

  const actifs = Boolean(filtres.type || filtres.status || filtres.search);

  const encaisse = liste.data
    .filter((t) => t.status === "succeeded")
    .reduce((somme, t) => somme + t.amount, 0);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-display-sm font-extrabold">Paiements</h1>
        <a
          href={`/admin/exports/transactions${parametres({
            type: filtres.type,
            status: filtres.status,
          })}`}
          className="text-sm text-ink underline decoration-rule underline-offset-4 hover:decoration-ink"
        >
          Exporter en CSV
        </a>
      </header>

      <Filtres actifs={actifs} base="/admin/paiements">
        <ChampFiltre etiquette="Recherche" pour="search" large>
          <Saisie
            id="search"
            name="search"
            defaultValue={filtres.search ?? ""}
            placeholder="Référence ou téléphone du payeur"
          />
        </ChampFiltre>

        <ChampFiltre etiquette="Flux" pour="type">
          <Liste id="type" name="type" defaultValue={filtres.type ?? ""}>
            {types.map((t) => (
              <option key={t.valeur} value={t.valeur}>
                {t.libelle}
              </option>
            ))}
          </Liste>
        </ChampFiltre>

        <ChampFiltre etiquette="Statut" pour="status">
          <Liste id="status" name="status" defaultValue={filtres.status ?? ""}>
            {statuts.map((s) => (
              <option key={s.valeur} value={s.valeur}>
                {s.libelle}
              </option>
            ))}
          </Liste>
        </ChampFiltre>
      </Filtres>

      {liste.data.length === 0 ? (
        <p className="mt-7 border border-rule bg-paper-raised px-5 py-10 text-sm text-paper-soft">
          {actifs
            ? "Aucun paiement ne correspond à ces filtres."
            : "Aucun paiement enregistré pour le moment."}
        </p>
      ) : (
        <>
          <div className="mt-7 overflow-x-auto border border-rule bg-paper-raised">
            <table className="w-full min-w-[56rem] text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-paper-soft">
                  <th scope="col" className="px-5 py-3 font-medium">Référence</th>
                  <th scope="col" className="px-5 py-3 font-medium">Flux</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Montant</th>
                  <th scope="col" className="px-5 py-3 font-medium">Statut</th>
                  <th scope="col" className="px-5 py-3 font-medium">Payeur</th>
                  <th scope="col" className="px-5 py-3 font-medium">Date</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {liste.data.map((t) => (
                  <tr key={t.reference} className="transition-colors hover:bg-paper">
                    <td className="chiffre px-5 py-3 whitespace-nowrap">
                      {t.reference}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">{t.type_label}</td>
                    <td className="montant px-5 py-3 text-right whitespace-nowrap">
                      {nombre(t.amount)}
                    </td>
                    <td className="px-5 py-3">
                      <StatutTransactionBadge
                        statut={t.status}
                        libelle={t.status_label}
                      />
                      {t.failure_reason ? (
                        <span className="mt-1 block text-xs text-paper-soft">
                          {t.failure_reason}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-5 py-3">
                      <span className="block max-w-40 truncate">
                        {t.payer_name ?? "—"}
                      </span>
                      <span className="chiffre block text-xs text-paper-soft">
                        {telephone(t.payer_phone)}
                      </span>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-paper-soft">
                      {dateHeure(t.paid_at ?? t.created_at)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {/* La verification n'a de sens que sur un paiement non
                          tranche : un etat final ne change plus. */}
                      {t.is_final ? null : (
                        <BoutonVerifier reference={t.reference} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            meta={liste.meta}
            construire={(page) => `/admin/paiements${parametres({ ...filtres, page })}`}
          />

          <p className="mt-6 text-xs text-paper-soft">
            Montants en FCFA. Encaissé sur cette page&nbsp;:{" "}
            <span className="chiffre">{fcfa(encaisse)}</span>. Le total de
            l&apos;événement figure sur le tableau de bord.
          </p>
        </>
      )}
    </div>
  );
}
