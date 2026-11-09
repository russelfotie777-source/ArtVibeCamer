import { BandePartenaires, LogoEvenement } from "@/components/Marque";
import { NavSite } from "@/components/NavSite";
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

  const lieu = [r?.event_venue, r?.event_city].filter(Boolean).join(", ");
  const telephones = [r?.contact_phone, r?.contact_phone_2].filter(
    (t): t is string => Boolean(t),
  );

  return (
    <div className="terrain-sombre flex min-h-dvh flex-col">
      <a
        href="#contenu"
        className="sr-only rounded-controle bg-accent px-3 py-2 text-sm font-semibold text-sur-accent focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-10"
      >
        Aller au contenu
      </a>

      <header className="border-b border-bordure">
        <div className="cadre flex h-16 items-center justify-between gap-4">
          <LogoEvenement hauteur={40} priorite className="shrink-0" />
          <NavSite />
        </div>
      </header>

      <main id="contenu" className="flex-1">
        {children}
      </main>

      <BandePartenaires telephone={r?.contact_phone} />

      <footer className="border-t border-bordure">
        <div className="cadre grid gap-8 py-12 md:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <LogoEvenement hauteur={40} href={null} />
            {r?.event_tagline ? (
              <p className="mt-4 max-w-sm text-sm text-discret">
                {r.event_tagline}
              </p>
            ) : null}
          </div>

          <dl className="grid content-start gap-x-8 gap-y-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
            {lieu ? (
              <>
                <dt className="text-discret">Lieu</dt>
                <dd>{lieu}</dd>
              </>
            ) : null}
            {telephones.length > 0 ? (
              <>
                <dt className="text-discret">Téléphone</dt>
                <dd className="flex flex-wrap gap-x-4">
                  {telephones.map((t) => (
                    <a
                      key={t}
                      href={`tel:${t.replace(/\s/g, "")}`}
                      className="chiffre whitespace-nowrap transition-colors hover:text-lien"
                    >
                      {t}
                    </a>
                  ))}
                </dd>
              </>
            ) : null}
            {r?.contact_email ? (
              <>
                <dt className="text-discret">Email</dt>
                <dd>
                  <a href={`mailto:${r.contact_email}`} className="transition-colors hover:text-lien">
                    {r.contact_email}
                  </a>
                </dd>
              </>
            ) : null}
            {r?.registration_window ? (
              <>
                <dt className="text-discret">Inscriptions</dt>
                <dd>{r.registration_window}</dd>
              </>
            ) : null}
          </dl>
        </div>
      </footer>
    </div>
  );
}
