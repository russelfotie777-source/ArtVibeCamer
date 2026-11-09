import Link from "next/link";
import { lireAdmin, parametres } from "@/lib/api";
import { dateHeure, fcfa, nombre } from "@/lib/format";
import { StatutCandidatBadge } from "@/components/ui/Statut";
import type { Candidat, Page, TableauDeBord } from "@/lib/types";

export const metadata = { title: "Tableau de bord" };

export default async function PageTableauDeBord() {
  const [bord, aValider] = await Promise.all([
    lireAdmin<TableauDeBord>("/admin/dashboard"),
    lireAdmin<Page<Candidat>>(
      `/admin/candidates${parametres({ status: "pending_review", per_page: 6 })}`,
    ),
  ]);

  const { candidates, revenue, payments } = bord.overview;

  const alertes = Object.entries(bord.alerts).filter(([, v]) => v > 0);

  const libelleAlerte: Record<string, string> = {
    stale_transactions: "paiement(s) bloqué(s) au-delà du délai",
    unprocessed_webhooks: "notification(s) de paiement non traitée(s)",
    invalid_signatures: "notification(s) à signature invalide",
    expired_orders: "commande(s) de billets expirée(s)",
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl">
          Tableau de bord
        </h1>
        <p className="text-xs text-discret">
          Arrêté au {dateHeure(bord.generated_at)}
        </p>
      </header>

      {/* Les alertes passent avant les chiffres : elles demandent une action. */}
      {alertes.length > 0 ? (
        <div
          role="alert"
          className="rounded-region mt-6 border border-alerte bg-alerte-fond px-4 py-4"
        >
          <h2 className="text-base text-alerte">
            À regarder
          </h2>
          <ul className="mt-2 grid gap-1 text-sm text-fort">
            {alertes.map(([cle, valeur]) => (
              <li key={cle}>
                <span className="chiffre font-semibold">{valeur}</span>{" "}
                {libelleAlerte[cle] ?? cle}
              </li>
            ))}
          </ul>
          <Link
            href="/admin/paiements?status=processing"
            className="mt-4 inline-block text-sm text-alerte underline decoration-alerte underline-offset-4"
          >
            Ouvrir le suivi des paiements
          </Link>
        </div>
      ) : null}

      {/* Bandeau de chiffres : separations par filets, sans empilement de
          cartes identiques. */}
      <section className="mt-10">
        <h2 className="sr-only">Inscriptions</h2>
        <dl className="overflow-hidden rounded-region grid gap-px border border-bordure bg-bordure sm:grid-cols-2 lg:grid-cols-4">
          {[
            { terme: "Candidats inscrits", valeur: nombre(candidates.total) },
            { terme: "Inscriptions payées", valeur: nombre(candidates.paid) },
            { terme: "Dossiers à valider", valeur: nombre(candidates.pending_review) },
            { terme: "Candidats en lice", valeur: nombre(candidates.active) },
          ].map((item) => (
            <div key={item.terme} className="bg-surface px-4 py-4">
              <dt className="text-sm text-discret">{item.terme}</dt>
              <dd className="montant mt-1 text-3xl">{item.valeur}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-xl">Recettes</h2>
          <p className="text-xs text-discret">
            La passerelle prélève sa commission à l’encaissement.
          </p>
        </div>

        {/*
          Le net passe en premier et en grand : c'est ce que l'organisation
          touche, et donc le chiffre qu'elle communique à l'organisateur et
          aux sponsors. Le brut reste visible pour la réconciliation.
        */}
        <dl className="overflow-hidden rounded-region mt-4 grid gap-px border border-bordure bg-bordure sm:grid-cols-3">
          <div className="terrain-sombre px-4 py-4">
            <dt className="text-sm text-discret">Net reçu</dt>
            <dd className="montant mt-1 text-3xl text-accent">
              {fcfa(revenue.net)}
            </dd>
          </div>
          <div className="bg-surface px-4 py-4">
            <dt className="text-sm text-discret">Encaissé (brut)</dt>
            <dd className="montant mt-1 text-2xl">{fcfa(revenue.total)}</dd>
          </div>
          <div className="bg-surface px-4 py-4">
            <dt className="text-sm text-discret">Commission</dt>
            <dd className="montant mt-1 text-2xl">
              {revenue.fees > 0 ? `− ${fcfa(revenue.fees)}` : fcfa(0)}
            </dd>
            {revenue.total > 0 && revenue.fees > 0 ? (
              <dd className="chiffre mt-1 text-xs text-discret">
                soit{" "}
                {((revenue.fees / revenue.total) * 100).toLocaleString("fr-FR", {
                  maximumFractionDigits: 1,
                })}
                &#8239;%
              </dd>
            ) : null}
          </div>
        </dl>

        <h3 className="mt-8 text-sm font-semibold text-discret">
          Détail par flux, en brut
        </h3>
        <dl className="overflow-hidden rounded-region mt-4 grid gap-px border border-bordure bg-bordure sm:grid-cols-3">
          {[
            { terme: "Inscriptions", valeur: revenue.registrations },
            { terme: "Votes", valeur: revenue.votes },
            { terme: "Billets", valeur: revenue.tickets },
          ].map((item) => (
            <div key={item.terme} className="bg-surface px-4 py-4">
              <dt className="text-sm text-discret">{item.terme}</dt>
              <dd className="montant mt-1 text-xl">{fcfa(item.valeur)}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 text-sm text-discret">
          <span className="chiffre">{nombre(payments.succeeded)}</span> paiement
          {payments.succeeded > 1 ? "s" : ""} encaissé
          {payments.succeeded > 1 ? "s" : ""},{" "}
          <span className="chiffre">{nombre(payments.pending)}</span> en attente,{" "}
          <span className="chiffre">{nombre(payments.failed)}</span> échoué
          {payments.failed > 1 ? "s" : ""}.
        </p>
      </section>

      {/* --- Dossiers a valider ---------------------------------------- */}
      <section className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-xl">
            Dossiers à valider
          </h2>
          {candidates.pending_review > 0 ? (
            <Link
              href="/admin/candidats?status=pending_review"
              className="text-sm text-fort underline decoration-bordure-forte underline-offset-4 hover:decoration-fort"
            >
              {candidates.pending_review === 1
                ? "Voir le dossier"
                : `Voir les ${nombre(candidates.pending_review)}`}
            </Link>
          ) : null}
        </div>

        {aValider.data.length === 0 ? (
          <p className="rounded-region mt-4 border border-bordure bg-surface px-4 py-8 text-sm text-discret">
            Aucun dossier n’attend de validation. Les inscriptions payées
            apparaîtront ici.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-region mt-4 divide-y divide-bordure border border-bordure bg-surface">
            {aValider.data.map((candidat) => (
              <li key={candidat.id}>
                <Link
                  href={`/admin/candidats/${candidat.id}`}
                  className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 transition-colors hover:bg-appui"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {candidat.display_name}
                    </span>
                    <span className="text-xs text-discret">
                      <span className="chiffre">
                        {candidat.candidate_number ?? "sans numéro"}
                      </span>
                      {candidat.category ? `, ${candidat.category.name}` : ""}
                    </span>
                  </span>
                  <StatutCandidatBadge
                    statut={candidat.status}
                    libelle={candidat.status_label}
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* --- Repartition par categorie --------------------------------- */}
      <section className="mt-12">
        <h2 className="text-xl">Par catégorie</h2>

        <div className="rounded-region mt-4 overflow-x-auto border border-bordure bg-surface">
          <table className="w-full min-w-xl text-sm">
            <thead>
              <tr className="border-b border-bordure text-left text-discret">
                <th scope="col" className="px-4 py-3 font-semibold">Catégorie</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Frais</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Inscrits</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">En lice</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Recettes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bordure">
              {bord.by_category.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-semibold">{c.name}</td>
                  <td className="chiffre px-4 py-3 text-right">
                    {nombre(c.registration_fee)}
                  </td>
                  <td className="chiffre px-4 py-3 text-right">
                    {nombre(c.candidates_count)}
                  </td>
                  <td className="chiffre px-4 py-3 text-right">
                    {nombre(c.active_candidates)}
                  </td>
                  <td className="chiffre px-4 py-3 text-right">
                    {nombre(c.candidates_count * c.registration_fee)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-discret">
          Les recettes par catégorie sont estimées à partir des inscriptions
          payées. Le montant réellement encaissé figure dans le suivi des
          paiements.
        </p>
      </section>
    </div>
  );
}
