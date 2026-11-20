import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GestionVotes } from "@/components/admin/GestionVotes";
import { ErreurApi, lireAdmin } from "@/lib/api";
import type { CategorieAdmin, LotsSuspectsResponse, Page, Utilisateur, VoteAdmin } from "@/lib/types";

export const metadata: Metadata = {
  title: "Modération des votes — Back-office",
};

export default async function PageVotes({
  searchParams,
}: {
  searchParams: Promise<{ [cle: string]: string | string[] | undefined }>;
}) {
  let utilisateur: Utilisateur;
  try {
    const me = await lireAdmin<{ user: Utilisateur }>("/admin/me");
    utilisateur = me.user;
  } catch (erreur) {
    if (erreur instanceof ErreurApi && (erreur.estAuthentification || erreur.statut === 403)) {
      redirect("/connexion");
    }
    throw erreur;
  }

  if (!utilisateur.capabilities.back_office) {
    redirect("/admin");
  }

  const params = await searchParams;
  const page = typeof params.page === "string" ? params.page : "1";
  const categoryId = typeof params.category_id === "string" ? params.category_id : "";
  const status = typeof params.status === "string" ? params.status : "";
  const phone = typeof params.phone === "string" ? params.phone : "";
  const ip = typeof params.ip === "string" ? params.ip : "";
  const thresholdStr = typeof params.threshold === "string" ? params.threshold : "10";
  const threshold = Math.max(2, parseInt(thresholdStr, 10) || 10);

  const queryParams = new URLSearchParams();
  queryParams.set("page", page);
  if (categoryId) queryParams.set("category_id", categoryId);
  if (status) queryParams.set("status", status);
  if (phone) queryParams.set("phone", phone);
  if (ip) queryParams.set("ip", ip);

  const [reponseVotes, reponseSuspects, reponseCategories] = await Promise.all([
    lireAdmin<Page<VoteAdmin>>(`/admin/votes?${queryParams.toString()}`).catch(() => ({
      data: [],
      links: { first: "", last: "", prev: null, next: null },
      meta: { current_page: 1, from: null, last_page: 1, path: "", per_page: 25, to: null, total: 0 },
    })),
    lireAdmin<LotsSuspectsResponse>(`/admin/votes/suspicious?threshold=${threshold}`).catch(() => null),
    lireAdmin<{ data: CategorieAdmin[] }>("/admin/categories").catch(() => ({ data: [] })),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-affiche text-fort">
            Modération des votes
          </h1>
          <p className="mt-1 text-sm text-discret">
            Surveillance du scrutin, identification des concentrations suspectes et annulation de lots frauduleux.
          </p>
        </div>
      </div>

      <GestionVotes
        votesPaginees={reponseVotes}
        lotsSuspects={reponseSuspects}
        categories={reponseCategories.data}
        seuilInitial={threshold}
        peutGerer={utilisateur.capabilities.manage}
      />
    </div>
  );
}
