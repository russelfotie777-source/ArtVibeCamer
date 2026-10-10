import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionsCandidat } from "@/components/admin/ActionsCandidat";
import { StatutCandidatBadge, StatutTransactionBadge } from "@/components/ui/Statut";
import { ErreurApi, lireAdmin } from "@/lib/api";
import { dateCourte, dateHeure, fcfa, telephone } from "@/lib/format";
import type { Candidat, Enveloppe } from "@/lib/types";

export const metadata = { title: "Fiche candidat" };

function Ligne({
  terme,
  children,
}: {
  terme: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 py-3">
      <dt className="text-sm text-paper-soft">{terme}</dt>
      <dd className="text-right text-sm">{children}</dd>
    </div>
  );
}

export default async function PageCandidat({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let candidat: Candidat;

  try {
    const reponse = await lireAdmin<Enveloppe<Candidat>>(`/admin/candidates/${id}`);
    candidat = reponse.data;
  } catch (erreur) {
    if (erreur instanceof ErreurApi && erreur.statut === 404) notFound();
    throw erreur;
  }

  const paiement = candidat.registration_transaction ?? null;
  const reseaux = Object.entries(candidat.socials ?? {}).filter(
    ([, url]) => Boolean(url),
  );

  return (
    <div className="mx-auto w-full max-w-5xl">
      <Link
        href="/admin/candidats"
        className="text-sm text-paper-soft underline decoration-rule underline-offset-4 hover:text-ink hover:decoration-ink"
      >
        Retour aux candidats
      </Link>

      <header className="mt-5 flex flex-wrap items-start justify-between gap-5">
        <div className="flex items-start gap-5">
          {candidat.photo_url ? (
            <Image
              src={candidat.photo_url}
              alt={`Photo de ${candidat.display_name}`}
              width={96}
              height={96}
              className="panneau size-24 border border-rule object-cover"
              unoptimized
            />
          ) : (
            <div className="panneau flex size-24 items-center justify-center border border-rule bg-paper text-xs text-paper-soft">
              Sans photo
            </div>
          )}

          <div>
            <p className="chiffre text-sm text-brass">
              {candidat.candidate_number ?? "Numéro non attribué"}
            </p>
            <h1 className="mt-1 font-display text-display-sm font-extrabold">
              {candidat.display_name}
            </h1>
            <p className="mt-1 text-sm text-paper-soft">
              {candidat.category?.name ?? "Sans catégorie"} —{" "}
              {candidat.is_group
                ? `groupe de ${candidat.members_count}`
                : "individuel"}
            </p>
            {candidat.full_name && candidat.stage_name ? (
              <p className="text-sm text-paper-soft">
                À l&apos;état civil : {candidat.full_name}
              </p>
            ) : null}
          </div>
        </div>

        <StatutCandidatBadge
          statut={candidat.status}
          libelle={candidat.status_label}
        />
      </header>

      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="grid content-start gap-8">
          <section className="panneau border border-rule bg-paper-raised">
            <div className="border-b border-rule px-5 py-4">
              <h2 className="font-display text-lg font-extrabold">Coordonnées</h2>
            </div>
            <dl className="divide-y divide-rule">
              <Ligne terme="Téléphone">
                <a href={`tel:${candidat.phone}`} className="chiffre hover:text-brass">
                  {telephone(candidat.phone)}
                </a>
              </Ligne>
              {candidat.whatsapp ? (
                <Ligne terme="WhatsApp">
                  <span className="chiffre">{telephone(candidat.whatsapp)}</span>
                </Ligne>
              ) : null}
              {candidat.email ? (
                <Ligne terme="Email">
                  <a href={`mailto:${candidat.email}`} className="hover:text-brass">
                    {candidat.email}
                  </a>
                </Ligne>
              ) : null}
              {candidat.city ? <Ligne terme="Ville">{candidat.city}</Ligne> : null}
              {candidat.date_of_birth ? (
                <Ligne terme="Date de naissance">
                  {dateCourte(candidat.date_of_birth)}
                </Ligne>
              ) : null}
              <Ligne terme="Inscrit le">{dateHeure(candidat.created_at)}</Ligne>
            </dl>
          </section>

          {candidat.presentation ? (
            <section className="panneau border border-rule bg-paper-raised">
              <div className="border-b border-rule px-5 py-4">
                <h2 className="font-display text-lg font-extrabold">Présentation</h2>
              </div>
              <div className="px-5 py-5">
                <p className="prose-etroit text-sm leading-relaxed whitespace-pre-line">
                  {candidat.presentation}
                </p>
              </div>
            </section>
          ) : null}

          {candidat.is_group ? (
            <section className="panneau border border-rule bg-paper-raised">
              <div className="border-b border-rule px-5 py-4">
                <h2 className="font-display text-lg font-extrabold">
                  Composition du groupe
                </h2>
                <p className="mt-1 text-sm text-paper-soft">
                  Liste déclarée à l&apos;inscription. Elle sert au contrôle le
                  jour du casting.
                </p>
              </div>

              {candidat.members && candidat.members.length > 0 ? (
                <ol className="divide-y divide-rule">
                  {candidat.members.map((membre, i) => (
                    <li
                      key={`${membre.full_name}-${i}`}
                      className="flex items-center gap-4 px-5 py-3"
                    >
                      {membre.photo_url ? (
                        <Image
                          src={membre.photo_url}
                          alt=""
                          width={40}
                          height={40}
                          className="controle size-10 shrink-0 border border-rule object-cover"
                          unoptimized
                        />
                      ) : (
                        <span className="controle flex size-10 shrink-0 items-center justify-center border border-rule bg-paper text-xs text-paper-soft">
                          {i + 1}
                        </span>
                      )}
                      <span className="text-sm font-medium">
                        {membre.full_name}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="px-5 py-5 text-sm text-paper-soft">
                  Aucun membre déclaré.
                </p>
              )}
            </section>
          ) : null}

          {reseaux.length > 0 ? (
            <section className="panneau border border-rule bg-paper-raised">
              <div className="border-b border-rule px-5 py-4">
                <h2 className="font-display text-lg font-extrabold">Réseaux</h2>
              </div>
              <dl className="divide-y divide-rule">
                {reseaux.map(([nom, url]) => (
                  <Ligne key={nom} terme={nom}>
                    <a
                      href={url as string}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="break-all underline decoration-rule underline-offset-4 hover:decoration-ink"
                    >
                      {url}
                    </a>
                  </Ligne>
                ))}
              </dl>
            </section>
          ) : null}
        </div>

        <div className="grid content-start gap-8 lg:sticky lg:top-8">
          <ActionsCandidat candidat={candidat} />

          <section className="panneau border border-rule bg-paper-raised">
            <div className="border-b border-rule px-5 py-4">
              <h2 className="font-display text-lg font-extrabold">
                Frais d&apos;inscription
              </h2>
            </div>

            {paiement ? (
              <dl className="divide-y divide-rule">
                <Ligne terme="Montant">
                  <span className="montant text-base">
                    {fcfa(paiement.amount)}
                  </span>
                </Ligne>
                <Ligne terme="Statut">
                  <StatutTransactionBadge
                    statut={paiement.status}
                    libelle={paiement.status_label}
                  />
                </Ligne>
                {paiement.payment_method_label ? (
                  <Ligne terme="Moyen">{paiement.payment_method_label}</Ligne>
                ) : null}
                <Ligne terme="Référence">
                  <Link
                    href={`/admin/paiements?search=${paiement.reference}`}
                    className="chiffre underline decoration-rule underline-offset-4 hover:decoration-ink"
                  >
                    {paiement.reference}
                  </Link>
                </Ligne>
                {paiement.paid_at ? (
                  <Ligne terme="Payé le">{dateHeure(paiement.paid_at)}</Ligne>
                ) : null}
              </dl>
            ) : (
              <p className="px-5 py-5 text-sm leading-relaxed text-paper-soft">
                Aucun encaissement rattaché. Le candidat a commencé son
                inscription sans aller au bout du paiement.
                {candidat.category
                  ? ` Frais attendus : ${fcfa(candidat.category.registration_fee)}.`
                  : ""}
              </p>
            )}
          </section>

          {candidat.reviewed_at ? (
            <section className="panneau border border-rule bg-paper-raised">
              <div className="border-b border-rule px-5 py-4">
                <h2 className="font-display text-lg font-extrabold">Décision</h2>
              </div>
              <dl className="divide-y divide-rule">
                <Ligne terme="Traité le">{dateHeure(candidat.reviewed_at)}</Ligne>
                {candidat.reviewer ? (
                  <Ligne terme="Par">{candidat.reviewer}</Ligne>
                ) : null}
                {candidat.rejection_reason ? (
                  <Ligne terme="Motif">{candidat.rejection_reason}</Ligne>
                ) : null}
              </dl>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
