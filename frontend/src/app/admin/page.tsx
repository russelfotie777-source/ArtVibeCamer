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
        <h1 className="font-display text-display-sm font-extrabold">
          Tableau de bord
        </h1>
        <p className="text-xs text-paper-soft">
          Arrêté au {dateHeure(bord.generated_at)}
        </p>
      </header>

      {/* Les alertes passent avant les chiffres : elles demandent une action. */}
      {alertes.length > 0 ? (
        <div
          role="alert"
          className="panneau mt-7 border-l-2 border-amber bg-amber-wash px-5 py-4"
        >
          <h2 className="font-display text-base font-extrabold text-amber">
            À regarder
          </h2>
          <ul className="mt-2 grid gap-1 text-sm text-ink">
            {alertes.map(([cle, valeur]) => (
              <li key={cle}>
                <span className="chiffre font-medium">{valeur}</span>{" "}
                {libelleAlerte[cle] ?? cle}
              </li>
            ))}
          </ul>
          <Link
            href="/admin/paiements?status=processing"
            className="mt-3 inline-block text-sm text-amber underline decoration-amber/40 underline-offset-4"
          >
            Ouvrir le suivi des paiements
          </Link>
        </div>
      ) : null}

      {/* Bandeau de chiffres : separations par filets, sans empilement de
          cartes identiques. */}
      <section className="mt-10">
        <h2 className="sr-only">Inscriptions</h2>
        <dl className="grid gap-px border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-4">
          {[
            { terme: "Candidats inscrits", valeur: nombre(candidates.total) },
            { terme: "Inscriptions payées", valeur: nombre(candidates.paid) },
            { terme: "Dossiers à valider", valeur: nombre(candidates.pending_review) },
            { terme: "Candidats en lice", valeur: nombre(candidates.active) },
          ].map((item) => (
            <div key={item.terme} className="bg-paper-raised px-5 py-5">
              <dt className="text-sm text-paper-soft">{item.terme}</dt>
              <dd className="montant mt-1 text-3xl">{item.valeur}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-xl font-extrabold">Recettes</h2>
          <p className="text-xs text-paper-soft">
            La passerelle prélève sa commission à l&apos;encaissement.
          </p>
        </div>

        {/*
          Le net passe en premier et en grand : c'est ce que l'organisation
          touche, et donc le chiffre qu'elle communique à l'organisateur et
          aux sponsors. Le brut reste visible pour la réconciliation.
        */}
        <dl className="mt-4 grid gap-px border border-rule bg-rule sm:grid-cols-3">
          <div className="bg-ink px-5 py-5 text-paper">
            <dt className="text-sm text-ink-soft">Net reçu</dt>
            <dd className="montant mt-1 text-3xl text-brass">
              {fcfa(revenue.net)}
            </dd>
          </div>
          <div className="bg-paper-raised px-5 py-5">
            <dt className="text-sm text-paper-soft">Encaissé (brut)</dt>
            <dd className="montant mt-1 text-2xl">{fcfa(revenue.total)}</dd>
          </div>
          <div className="bg-paper-raised px-5 py-5">
            <dt className="text-sm text-paper-soft">Commission</dt>
            <dd className="montant mt-1 text-2xl">
              {revenue.fees > 0 ? `− ${fcfa(revenue.fees)}` : fcfa(0)}
            </dd>
            {revenue.total > 0 && revenue.fees > 0 ? (
              <dd className="chiffre mt-1 text-xs text-paper-soft">
                soit {((revenue.fees / revenue.total) * 100).toFixed(1)} %
              </dd>
            ) : null}
          </div>
        </dl>

        <h3 className="mt-8 text-sm font-medium text-paper-soft">
          Détail par flux, en brut
        </h3>
        <dl className="mt-3 grid gap-px border border-rule bg-rule sm:grid-cols-3">
          {[
            { terme: "Inscriptions", valeur: revenue.registrations },
            { terme: "Votes", valeur: revenue.votes },
            { terme: "Billets", valeur: revenue.tickets },
          ].map((item) => (
            <div key={item.terme} className="bg-paper-raised px-5 py-4">
              <dt className="text-sm text-paper-soft">{item.terme}</dt>
              <dd className="montant mt-1 text-xl">{fcfa(item.valeur)}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-3 text-sm text-paper-soft">
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
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-xl font-extrabold">
            Dossiers à valider
          </h2>
          {candidates.pending_review > 0 ? (
            <Link
              href="/admin/candidats?status=pending_review"
              className="text-sm text-ink underline decoration-rule underline-offset-4 hover:decoration-ink"
            >
              {candidates.pending_review === 1
                ? "Voir le dossier"
                : `Voir les ${nombre(candidates.pending_review)}`}
            </Link>
          ) : null}
        </div>

        {aValider.data.length === 0 ? (
          <p className="mt-4 border border-rule bg-paper-raised px-5 py-8 text-sm text-paper-soft">
            Aucun dossier n&apos;attend de validation. Les inscriptions payées
            apparaîtront ici.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-rule border border-rule bg-paper-raised">
            {aValider.data.map((candidat) => (
              <li key={candidat.id}>
                <Link
                  href={`/admin/candidats/${candidat.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-paper"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {candidat.display_name}
                    </span>
                    <span className="text-xs text-paper-soft">
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
        <h2 className="font-display text-xl font-extrabold">Par catégorie</h2>

        <div className="mt-4 overflow-x-auto border border-rule bg-paper-raised">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-rule text-left text-paper-soft">
                <th scope="col" className="px-5 py-3 font-medium">Catégorie</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Frais</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Inscrits</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">En lice</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">Recettes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {bord.by_category.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-3 font-medium">{c.name}</td>
                  <td className="chiffre px-5 py-3 text-right">
                    {nombre(c.registration_fee)}
                  </td>
                  <td className="chiffre px-5 py-3 text-right">
                    {nombre(c.candidates_count)}
                  </td>
                  <td className="chiffre px-5 py-3 text-right">
                    {nombre(c.active_candidates)}
                  </td>
                  <td className="chiffre px-5 py-3 text-right">
                    {nombre(c.candidates_count * c.registration_fee)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-paper-soft">
          Les recettes par catégorie sont estimées à partir des inscriptions
          payées. Le montant réellement encaissé figure dans le suivi des
          paiements.
        </p>
      </section>
    </div>
  );
}
