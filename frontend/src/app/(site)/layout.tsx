import Link from "next/link";
import { BandePartenaires, LogoEvenement } from "@/components/Marque";
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

  return (
    <div className="flex min-h-dvh flex-col bg-ink text-paper">

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-4 py-5 min-[30rem]:gap-4 sm:px-8 sm:py-6">
        <LogoEvenement hauteur={36} priorite className="shrink-0" />

        <nav
          aria-label="Navigation principale"
          className="flex items-center gap-2 text-xs min-[30rem]:gap-4 min-[30rem]:text-sm"
        >
          <Link
            href="/candidats"
            className="py-3 text-ink-soft transition-colors hover:text-brass"
          >
            Candidats
          </Link>
          <Link
            href="/inscription"
            className="py-3 text-ink-soft transition-colors hover:text-brass"
          >
            S&apos;inscrire
          </Link>
          <Link
            href="/admin"
            className="hidden py-3 text-ink-soft transition-colors hover:text-brass min-[30rem]:inline"
          >
            Organisation
          </Link>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <BandePartenaires />

      <footer className="border-t border-ink-line/60">
        <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <LogoEvenement hauteur={36} href={null} />
              {r?.event_tagline ? (
                <p className="prose-etroit mt-3 text-sm text-ink-soft">
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
