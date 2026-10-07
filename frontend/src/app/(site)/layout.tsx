import Link from "next/link";
import { BandeMotif } from "@/components/Motif";
import { lirePublic } from "@/lib/api";
import type { Enveloppe, Reglages } from "@/lib/types";

async function reglages(): Promise<Reglages | null> {
  try {
    const { data } = await lirePublic<Enveloppe<Reglages>>("/settings");
    return data;
  } catch {
    // Le site reste navigable si l'API ne repond pas : on retombe sur les
    // valeurs d'environnement plutot que d'afficher une page blanche.
    return null;
  }
}

export default async function LayoutSite({
  children,
}: {
  children: React.ReactNode;
}) {
  const r = await reglages();
  const nom = r?.event_name ?? process.env.NEXT_PUBLIC_SITE_NAME ?? "ArtVibeCamer";

  return (
    <div className="flex min-h-dvh flex-col bg-ink text-paper">
      {/* Le motif toghu, une seule fois : en tete de page, comme un galon. */}
      <BandeMotif hauteur={12} />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-6 sm:px-8">
        <Link
          href="/"
          className="font-display text-xl font-extrabold tracking-tight text-paper"
        >
          {nom}
        </Link>

        <nav className="flex items-center gap-5 text-sm">
          <Link
            href="/inscription"
            className="text-ink-soft transition-colors hover:text-brass"
          >
            S&apos;inscrire
          </Link>
          <Link
            href="/admin"
            className="text-ink-soft transition-colors hover:text-brass"
          >
            Organisation
          </Link>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-ink-line/60">
        <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-display text-lg font-extrabold">{nom}</p>
              {r?.event_tagline ? (
                <p className="prose-etroit mt-1 text-sm text-ink-soft">
                  {r.event_tagline}
                </p>
              ) : null}
            </div>

            <dl className="grid gap-x-10 gap-y-2 text-sm sm:grid-cols-2">
              {r?.event_city ? (
                <div className="flex gap-2">
                  <dt className="text-ink-soft">Ville</dt>
                  <dd>{r.event_city}</dd>
                </div>
              ) : null}
              {r?.contact_phone ? (
                <div className="flex gap-2">
                  <dt className="text-ink-soft">Téléphone</dt>
                  <dd>
                    <a href={`tel:${r.contact_phone}`} className="hover:text-brass">
                      {r.contact_phone}
                    </a>
                  </dd>
                </div>
              ) : null}
              {r?.contact_email ? (
                <div className="flex gap-2">
                  <dt className="text-ink-soft">Email</dt>
                  <dd>
                    <a href={`mailto:${r.contact_email}`} className="hover:text-brass">
                      {r.contact_email}
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>
      </footer>
    </div>
  );
}
