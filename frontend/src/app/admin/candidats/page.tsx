import Link from "next/link";
import { ChampFiltre, Filtres, Pagination } from "@/components/admin/Filtres";
import { Liste, Saisie } from "@/components/ui/Champ";
import { StatutCandidatBadge } from "@/components/ui/Statut";
import { lireAdmin, parametres } from "@/lib/api";
import { dateCourte, nombre, telephone } from "@/lib/format";
import type { Candidat, Categorie, Page } from "@/lib/types";

export const metadata = { title: "Candidats" };

const statuts = [
  { valeur: "", libelle: "Tous les statuts" },
  { valeur: "awaiting_payment", libelle: "En attente de paiement" },
  { valeur: "pending_review", libelle: "À valider" },
  { valeur: "active", libelle: "Validés" },
  { valeur: "rejected", libelle: "Rejetés" },
  { valeur: "withdrawn", libelle: "Retirés" },
];

export default async function PageCandidats({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const filtres = await searchParams;

  const requete = parametres({
    status: filtres.status,
    category_id: filtres.category_id,
    search: filtres.search,
    unpaid: filtres.unpaid,
    page: filtres.page,
    per_page: 25,
  });

  const [liste, categories] = await Promise.all([
    lireAdmin<Page<Candidat>>(`/admin/candidates${requete}`),
    lireAdmin<{ data: Categorie[] }>("/admin/categories"),
  ]);

  const actifs = Boolean(
    filtres.status || filtres.category_id || filtres.search || filtres.unpaid,
  );

  const lien = (page: number) =>
    `/admin/candidats${parametres({ ...filtres, page })}`;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl">Candidats</h1>
        <a
          href={`/admin/exports/candidates${parametres({
            status: filtres.status,
            category_id: filtres.category_id,
          })}`}
          className="text-sm text-fort underline decoration-bordure-forte underline-offset-4 hover:decoration-fort"
        >
          Exporter en CSV
        </a>
      </header>

      <Filtres actifs={actifs} base="/admin/candidats">
        <ChampFiltre etiquette="Recherche" pour="search" large>
          <Saisie
            id="search"
            name="search"
            defaultValue={filtres.search ?? ""}
            placeholder="Nom, numéro, téléphone, email"
          />
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

        <ChampFiltre etiquette="Catégorie" pour="category_id">
          <Liste
            id="category_id"
            name="category_id"
            defaultValue={filtres.category_id ?? ""}
          >
            <option value="">Toutes</option>
            {categories.data.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Liste>
        </ChampFiltre>
      </Filtres>

      {liste.data.length === 0 ? (
        <p className="rounded-region mt-6 border border-bordure bg-surface px-4 py-10 text-sm text-discret">
          {actifs
            ? "Aucun candidat ne correspond à ces filtres."
            : "Aucun candidat inscrit pour le moment. Les inscriptions apparaîtront ici dès le premier paiement."}
        </p>
      ) : (
        <>
          <div className="rounded-region mt-6 overflow-x-auto border border-bordure bg-surface">
            <table className="w-full min-w-4xl text-sm">
              <thead>
                <tr className="border-b border-bordure text-left text-discret">
                  <th scope="col" className="px-4 py-3 font-semibold">Numéro</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Candidat</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Catégorie</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Formule</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Téléphone</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Statut</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Inscrit le</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bordure">
                {liste.data.map((c) => (
                  <tr key={c.id} className="transition-colors hover:bg-appui">
                    <td className="chiffre px-4 py-3 whitespace-nowrap">
                      {c.candidate_number ?? (
                        <span className="text-discret">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/candidats/${c.id}`}
                        className="font-semibold underline decoration-bordure-forte underline-offset-4 hover:decoration-fort"
                      >
                        {c.display_name}
                      </Link>
                      {c.stage_name && c.full_name ? (
                        <span className="block text-xs text-discret">
                          {c.full_name}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {c.category?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {c.is_group ? (
                        <>
                          Groupe
                          <span className="chiffre ml-1 text-xs text-discret">
                            ({c.members_count})
                          </span>
                        </>
                      ) : (
                        "Individuel"
                      )}
                    </td>
                    <td className="chiffre px-4 py-3 whitespace-nowrap">
                      {telephone(c.phone)}
                    </td>
                    <td className="px-4 py-3">
                      <StatutCandidatBadge
                        statut={c.status}
                        libelle={c.status_label}
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-discret">
                      {dateCourte(c.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination meta={liste.meta} construire={lien} />
        </>
      )}

      <p className="mt-6 text-xs text-discret">
        Un candidat sans numéro n’a pas encore réglé ses frais
        d’inscription. Total affiché&nbsp;:{" "}
        <span className="chiffre">{nombre(liste.meta.total)}</span>.
      </p>
    </div>
  );
}
