"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { annulerVote } from "@/app/admin/actions";
import { fcfa } from "@/lib/format";
import type { CategorieAdmin, LotsSuspectsResponse, Page, VoteAdmin } from "@/lib/types";

export function GestionVotes({
  votesPaginees,
  lotsSuspects,
  categories,
  seuilInitial,
  peutGerer,
}: {
  votesPaginees: Page<VoteAdmin>;
  lotsSuspects: LotsSuspectsResponse | null;
  categories: CategorieAdmin[];
  seuilInitial: number;
  peutGerer: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Onglet actif : "tous" ou "suspects"
  const [onglet, setOnglet] = useState<"tous" | "suspects">("tous");

  // Filtres actifs
  const categorieFiltre = searchParams.get("category_id") ?? "";
  const statutFiltre = searchParams.get("status") ?? "";
  const telephoneFiltre = searchParams.get("phone") ?? "";
  const ipFiltre = searchParams.get("ip") ?? "";

  const [seuil, setSeuil] = useState(seuilInitial);

  // Etat du modal d'annulation
  const [voteAAnnuler, setVoteAAnnuler] = useState<VoteAdmin | null>(null);
  const [motifAnnulation, setMotifAnnulation] = useState("");
  const [erreurAction, setErreurAction] = useState<string | null>(null);
  const [succesAction, setSuccesAction] = useState<string | null>(null);

  function appliquerFiltre(cle: string, valeur: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (valeur) {
      params.set(cle, valeur);
    } else {
      params.delete(cle);
    }
    params.delete("page");
    startTransition(() => {
      router.push(`/admin/votes?${params.toString()}`);
    });
  }

  function changerSeuil(nouveauSeuil: number) {
    setSeuil(nouveauSeuil);
    const params = new URLSearchParams(searchParams.toString());
    params.set("threshold", String(nouveauSeuil));
    startTransition(() => {
      router.push(`/admin/votes?${params.toString()}`);
    });
  }

  function filtrerParIp(ip: string) {
    setOnglet("tous");
    appliquerFiltre("ip", ip);
  }

  async function confirmerAnnulation() {
    if (!voteAAnnuler) return;
    if (!motifAnnulation.trim()) {
      setErreurAction("Veuillez renseigner un motif pour justifier cette annulation.");
      return;
    }

    setErreurAction(null);
    setSuccesAction(null);

    const res = await annulerVote(voteAAnnuler.id, motifAnnulation);
    if (res.erreur) {
      setErreurAction(res.erreur);
    } else {
      setSuccesAction(res.succes ?? "Vote annulé et voix retirées.");
      setVoteAAnnuler(null);
      setMotifAnnulation("");
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      {/* Messages de retour */}
      {succesAction ? (
        <div className="rounded-controle bg-[#11953f]/10 p-4 text-sm font-semibold text-[#11953f] border border-[#11953f]/20">
          {succesAction}
        </div>
      ) : null}

      {erreurAction ? (
        <div className="rounded-controle bg-[#c70e20]/10 p-4 text-sm font-semibold text-[#c70e20] border border-[#c70e20]/20">
          {erreurAction}
        </div>
      ) : null}

      {/* Barre d'onglets superieure */}
      <div className="flex border-b border-bordure">
        <button
          type="button"
          onClick={() => setOnglet("tous")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            onglet === "tous"
              ? "border-accent text-fort"
              : "border-transparent text-discret hover:text-fort"
          }`}
        >
          Tous les votes
          <span className="rounded-pilule bg-appui px-2 py-0.5 text-xs text-texte">
            {votesPaginees.meta?.total ?? votesPaginees.data.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setOnglet("suspects")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            onglet === "suspects"
              ? "border-[#c70e20] text-[#c70e20]"
              : "border-transparent text-discret hover:text-fort"
          }`}
        >
          Lots suspects
          {lotsSuspects && (lotsSuspects.by_ip.length > 0 || lotsSuspects.by_fingerprint.length > 0) ? (
            <span className="rounded-pilule bg-[#c70e20] px-2 py-0.5 text-xs font-bold text-white">
              {lotsSuspects.by_ip.length + lotsSuspects.by_fingerprint.length}
            </span>
          ) : null}
        </button>
      </div>

      {onglet === "tous" ? (
        <div className="space-y-4">
          {/* Barre de filtres */}
          <div className="grid gap-3 rounded-surface border border-bordure bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="filtre-cat" className="block text-xs font-semibold text-discret">
                Discipline
              </label>
              <select
                id="filtre-cat"
                value={categorieFiltre}
                onChange={(e) => appliquerFiltre("category_id", e.target.value)}
                className="mt-1 block w-full rounded-controle border border-bordure bg-fond px-3 py-2 text-sm text-texte focus:border-accent focus:outline-none"
              >
                <option value="">Toutes les disciplines</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filtre-statut" className="block text-xs font-semibold text-discret">
                Statut
              </label>
              <select
                id="filtre-statut"
                value={statutFiltre}
                onChange={(e) => appliquerFiltre("status", e.target.value)}
                className="mt-1 block w-full rounded-controle border border-bordure bg-fond px-3 py-2 text-sm text-texte focus:border-accent focus:outline-none"
              >
                <option value="">Tous les statuts</option>
                <option value="confirmed">Confirmés (payés)</option>
                <option value="pending">En attente de paiement</option>
                <option value="cancelled">Annulés (frauduleux)</option>
              </select>
            </div>

            <div>
              <label htmlFor="filtre-tel" className="block text-xs font-semibold text-discret">
                Téléphone votant
              </label>
              <input
                id="filtre-tel"
                type="text"
                placeholder="Ex: 699123456"
                defaultValue={telephoneFiltre}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    appliquerFiltre("phone", (e.target as HTMLInputElement).value.trim());
                  }
                }}
                onBlur={(e) => appliquerFiltre("phone", e.target.value.trim())}
                className="mt-1 block w-full rounded-controle border border-bordure bg-fond px-3 py-2 text-sm text-texte focus:border-accent focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="filtre-ip" className="block text-xs font-semibold text-discret">
                Adresse IP
              </label>
              <div className="flex gap-1">
                <input
                  id="filtre-ip"
                  type="text"
                  placeholder="Ex: 192.168.1.1"
                  defaultValue={ipFiltre}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      appliquerFiltre("ip", (e.target as HTMLInputElement).value.trim());
                    }
                  }}
                  onBlur={(e) => appliquerFiltre("ip", e.target.value.trim())}
                  className="mt-1 block w-full rounded-controle border border-bordure bg-fond px-3 py-2 text-sm text-texte focus:border-accent focus:outline-none"
                />
                {ipFiltre ? (
                  <button
                    type="button"
                    onClick={() => appliquerFiltre("ip", "")}
                    className="mt-1 rounded-controle border border-bordure px-2 text-xs text-discret hover:bg-appui"
                    title="Effacer le filtre IP"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* Tableau des votes */}
          <div className="overflow-x-auto rounded-surface border border-bordure bg-surface shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-bordure bg-coque text-xs font-semibold text-discret uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3">Réf / Date</th>
                  <th scope="col" className="px-4 py-3">Candidat</th>
                  <th scope="col" className="px-4 py-3 text-right">Voix</th>
                  <th scope="col" className="px-4 py-3 text-right">Montant</th>
                  <th scope="col" className="px-4 py-3">Votant & IP</th>
                  <th scope="col" className="px-4 py-3">Statut</th>
                  <th scope="col" className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bordure">
                {votesPaginees.data.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-discret">
                      Aucun vote ne correspond aux filtres appliqués.
                    </td>
                  </tr>
                ) : (
                  votesPaginees.data.map((v) => {
                    const estAnnule = v.status === "cancelled";
                    const estConfirme = v.status === "confirmed";

                    return (
                      <tr key={v.id} className="hover:bg-coque/60 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-semibold text-fort">
                            #{v.id ?? v.reference}
                          </span>
                          <div className="text-xs text-discret">
                            {new Date(v.created_at).toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="font-semibold text-fort">
                            {v.candidate?.stage_name ||
                              `${v.candidate?.first_name ?? ""} ${v.candidate?.last_name ?? ""}`}
                          </div>
                          {v.candidate?.candidate_number ? (
                            <span className="font-mono text-xs text-discret">
                              N° {v.candidate.candidate_number}
                            </span>
                          ) : null}
                        </td>

                        <td className="px-4 py-3 text-right font-bold text-fort tabular-nums">
                          +{v.quantity}
                        </td>

                        <td className="px-4 py-3 text-right tabular-nums text-texte">
                          {fcfa(v.amount ?? v.total_amount ?? 0)}
                        </td>

                        <td className="px-4 py-3">
                          <div className="font-mono text-xs text-texte">{v.voter_phone}</div>
                          {v.ip_address ? (
                            <button
                              type="button"
                              onClick={() => filtrerParIp(v.ip_address!)}
                              className="font-mono text-[11px] text-discret underline hover:text-accent"
                              title="Filtrer sur cette IP"
                            >
                              {v.ip_address}
                            </button>
                          ) : (
                            <span className="text-xs text-discret">-</span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          {estConfirme ? (
                            <span className="inline-flex items-center rounded-pilule bg-[#11953f]/15 px-2.5 py-0.5 text-xs font-semibold text-[#11953f]">
                              Confirmé
                            </span>
                          ) : estAnnule ? (
                            <span className="inline-flex items-center rounded-pilule bg-[#c70e20]/15 px-2.5 py-0.5 text-xs font-semibold text-[#c70e20]">
                              Annulé
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-pilule bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-600">
                              En attente
                            </span>
                          )}
                          {estAnnule && v.cancellation_reason ? (
                            <div className="mt-1 text-[11px] text-discret italic max-w-xs truncate" title={v.cancellation_reason}>
                              {v.cancellation_reason}
                            </div>
                          ) : null}
                        </td>

                        <td className="px-4 py-3 text-right">
                          {peutGerer && estConfirme ? (
                            <button
                              type="button"
                              onClick={() => {
                                setVoteAAnnuler(v);
                                setMotifAnnulation("");
                                setErreurAction(null);
                              }}
                              className="rounded-controle border border-[#c70e20]/30 bg-[#c70e20]/5 px-2.5 py-1 text-xs font-semibold text-[#c70e20] hover:bg-[#c70e20] hover:text-white transition-colors"
                            >
                              Annuler le lot
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {votesPaginees.meta ? (
            <div className="flex items-center justify-between text-xs text-discret pt-2">
              <div>
                Page {votesPaginees.meta.current_page} sur {votesPaginees.meta.last_page} ({votesPaginees.meta.total} votes)
              </div>
              <div className="flex gap-2">
                {votesPaginees.links?.prev ? (
                  <button
                    type="button"
                    onClick={() => {
                      const params = new URLSearchParams(searchParams.toString());
                      params.set("page", String(votesPaginees.meta.current_page - 1));
                      startTransition(() => router.push(`/admin/votes?${params.toString()}`));
                    }}
                    className="rounded-controle border border-bordure px-3 py-1.5 hover:bg-appui text-fort"
                  >
                    Précédent
                  </button>
                ) : null}

                {votesPaginees.links?.next ? (
                  <button
                    type="button"
                    onClick={() => {
                      const params = new URLSearchParams(searchParams.toString());
                      params.set("page", String(votesPaginees.meta.current_page + 1));
                      startTransition(() => router.push(`/admin/votes?${params.toString()}`));
                    }}
                    className="rounded-controle border border-bordure px-3 py-1.5 hover:bg-appui text-fort"
                  >
                    Suivant
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        /* Onglet Lots suspects */
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-surface border border-bordure bg-surface p-4">
            <div>
              <h2 className="text-base font-semibold text-fort">
                Détection de volume anormal par source
              </h2>
              <p className="text-xs text-discret mt-0.5">
                Identifie les adresses IP ou empreintes ayant commandé un nombre inhabituel de votes.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="seuil-suspect" className="text-xs font-semibold text-texte whitespace-nowrap">
                Seuil de commandes :
              </label>
              <select
                id="seuil-suspect"
                value={seuil}
                onChange={(e) => changerSeuil(Number(e.target.value))}
                className="rounded-controle border border-bordure bg-fond px-3 py-1.5 text-xs font-semibold text-texte focus:border-accent focus:outline-none"
              >
                <option value={3}>Dès 3 commandes</option>
                <option value={5}>Dès 5 commandes</option>
                <option value={10}>Dès 10 commandes (défaut)</option>
                <option value={20}>Dès 20 commandes</option>
                <option value={50}>Dès 50 commandes</option>
              </select>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Par IP */}
            <div className="rounded-surface border border-bordure bg-surface p-4 shadow-sm">
              <h3 className="font-semibold text-sm text-fort flex items-center justify-between">
                <span>Concentration par Adresse IP</span>
                <span className="text-xs text-discret font-normal">
                  {lotsSuspects?.by_ip.length ?? 0} détectée(s)
                </span>
              </h3>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-bordure bg-coque text-discret">
                    <tr>
                      <th className="px-3 py-2">Adresse IP</th>
                      <th className="px-3 py-2 text-right">Commandes</th>
                      <th className="px-3 py-2 text-right">Voix</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bordure">
                    {!lotsSuspects || lotsSuspects.by_ip.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-8 text-center text-discret">
                          Aucune concentration suspecte par IP au seuil de {seuil}.
                        </td>
                      </tr>
                    ) : (
                      lotsSuspects.by_ip.map((item) => (
                        <tr key={item.ip_address} className="hover:bg-coque/50">
                          <td className="px-3 py-2 font-mono font-semibold text-fort">
                            {item.ip_address}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums text-texte">
                            {item.orders}
                          </td>
                          <td className="px-3 py-2 text-right font-bold tabular-nums text-[#c70e20]">
                            {item.votes}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => filtrerParIp(item.ip_address)}
                              className="rounded-controle border border-bordure px-2 py-1 text-[11px] text-discret hover:bg-appui hover:text-fort"
                            >
                              Voir les votes
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Par Empreinte digitale */}
            <div className="rounded-surface border border-bordure bg-surface p-4 shadow-sm">
              <h3 className="font-semibold text-sm text-fort flex items-center justify-between">
                <span>Concentration par Empreinte Navigateur</span>
                <span className="text-xs text-discret font-normal">
                  {lotsSuspects?.by_fingerprint.length ?? 0} détectée(s)
                </span>
              </h3>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-bordure bg-coque text-discret">
                    <tr>
                      <th className="px-3 py-2">Empreinte</th>
                      <th className="px-3 py-2 text-right">Commandes</th>
                      <th className="px-3 py-2 text-right">Voix</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bordure">
                    {!lotsSuspects || lotsSuspects.by_fingerprint.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-8 text-center text-discret">
                          Aucune concentration suspecte par empreinte au seuil de {seuil}.
                        </td>
                      </tr>
                    ) : (
                      lotsSuspects.by_fingerprint.map((item) => (
                        <tr key={item.fingerprint} className="hover:bg-coque/50">
                          <td className="px-3 py-2 font-mono text-[11px] text-discret truncate max-w-[12rem]" title={item.fingerprint}>
                            {item.fingerprint.slice(0, 16)}...
                          </td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums text-texte">
                            {item.orders}
                          </td>
                          <td className="px-3 py-2 text-right font-bold tabular-nums text-[#c70e20]">
                            {item.votes}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'annulation de vote */}
      {voteAAnnuler ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-surface border border-bordure bg-surface p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#c70e20]">
                  Annuler le lot de votes #{voteAAnnuler.id}
                </h3>
                <p className="text-xs text-discret mt-1">
                  Cette action est irréversible : les voix seront immédiatement retirées du compteur officiel du candidat.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVoteAAnnuler(null)}
                className="text-discret hover:text-fort text-lg"
              >
                ×
              </button>
            </div>

            <div className="rounded-controle bg-coque p-3 text-xs space-y-1">
              <div>
                <span className="font-semibold text-discret">Candidat :</span>{" "}
                <span className="font-bold text-fort">
                  {voteAAnnuler.candidate?.stage_name ||
                    `${voteAAnnuler.candidate?.first_name ?? ""} ${voteAAnnuler.candidate?.last_name ?? ""}`}
                </span>
              </div>
              <div>
                <span className="font-semibold text-discret">Voix concernées :</span>{" "}
                <span className="font-bold text-[#c70e20]">-{voteAAnnuler.quantity} voix</span>
              </div>
              <div>
                <span className="font-semibold text-discret">Montant payé :</span>{" "}
                <span className="text-texte">{fcfa(voteAAnnuler.amount ?? voteAAnnuler.total_amount ?? 0)}</span>
              </div>
              <div>
                <span className="font-semibold text-discret">Téléphone :</span>{" "}
                <span className="font-mono text-texte">{voteAAnnuler.voter_phone}</span>
              </div>
              {voteAAnnuler.ip_address ? (
                <div>
                  <span className="font-semibold text-discret">IP :</span>{" "}
                  <span className="font-mono text-texte">{voteAAnnuler.ip_address}</span>
                </div>
              ) : null}
            </div>

            <div>
              <label htmlFor="motif-annulation" className="block text-xs font-semibold text-texte mb-1">
                Motif d’annulation <span className="text-[#c70e20]">*</span>
              </label>
              <textarea
                id="motif-annulation"
                rows={3}
                value={motifAnnulation}
                onChange={(e) => setMotifAnnulation(e.target.value)}
                placeholder="Ex: Fraude constatée sur bot de paiement, contrefaçon de transactions..."
                className="w-full rounded-controle border border-bordure bg-fond p-2 text-xs text-texte focus:border-[#c70e20] focus:outline-none"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setVoteAAnnuler(null)}
                className="rounded-controle border border-bordure px-4 py-2 text-xs font-semibold text-discret hover:bg-appui"
              >
                Abandonner
              </button>
              <button
                type="button"
                disabled={isPending || !motifAnnulation.trim()}
                onClick={confirmerAnnulation}
                className="rounded-controle bg-[#c70e20] px-4 py-2 text-xs font-bold text-white hover:bg-[#a50918] disabled:opacity-50 transition-colors"
              >
                {isPending ? "Annulation en cours..." : "Confirmer le retrait des voix"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
