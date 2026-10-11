import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import {
  COOKIE_SESSION,
  ErreurApi,
  lireAdminBrut,
  parametres,
} from "@/lib/api";

const EXPORTS = {
  candidates: {
    chemin: "/admin/exports/candidates",
    filtres: ["status", "category_id"],
  },
  transactions: {
    chemin: "/admin/exports/transactions",
    filtres: ["type", "status"],
  },
} as const;

type Ressource = keyof typeof EXPORTS;

function estRessource(valeur: string): valeur is Ressource {
  return Object.hasOwn(EXPORTS, valeur);
}

async function versConnexion(requete: NextRequest): Promise<Response> {
  (await cookies()).delete(COOKIE_SESSION);

  return Response.redirect(new URL("/connexion", requete.url), 303);
}

function erreurExport(statut: number): Response {
  const message =
    statut === 403
      ? "Vous n'avez pas les droits necessaires pour cet export."
      : "Impossible de generer cet export pour le moment.";

  return new Response(message, {
    status: statut,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Type": "text/plain; charset=UTF-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(
  requete: NextRequest,
  { params }: { params: Promise<{ ressource: string }> },
): Promise<Response> {
  const { ressource } = await params;

  if (!estRessource(ressource)) {
    return new Response("Export inconnu.", { status: 404 });
  }

  const definition = EXPORTS[ressource];
  const filtres = Object.fromEntries(
    definition.filtres.map((nom) => [nom, requete.nextUrl.searchParams.get(nom)]),
  );

  let reponse: Response;

  try {
    reponse = await lireAdminBrut(
      `${definition.chemin}${parametres(filtres)}`,
    );
  } catch (erreur) {
    if (erreur instanceof ErreurApi && erreur.estAuthentification) {
      return versConnexion(requete);
    }

    return erreurExport(502);
  }

  if (reponse.status === 401) return versConnexion(requete);
  if (!reponse.ok) return erreurExport(reponse.status);

  const entetes = new Headers({
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Type": reponse.headers.get("content-type") ?? "text/csv; charset=UTF-8",
    "X-Content-Type-Options": "nosniff",
  });
  const disposition = reponse.headers.get("content-disposition");

  if (disposition) entetes.set("Content-Disposition", disposition);

  return new Response(reponse.body, {
    status: reponse.status,
    headers: entetes,
  });
}
