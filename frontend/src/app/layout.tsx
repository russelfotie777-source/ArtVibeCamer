import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

/*
 * Une seule famille. Bricolage Grotesque est chargee en local depuis
 * public/fonts/ pour garantir un rendu 100% identique a la production,
 * sans dependance externe reseau.
 */
const bricolage = localFont({
  src: [
    {
      path: "../../../public/fonts/bricolage-latin.woff2",
      weight: "200 800",
      style: "normal",
    },
    {
      path: "../../../public/fonts/bricolage-latin-ext.woff2",
      weight: "200 800",
      style: "normal",
    },
  ],
  variable: "--font-bricolage",
  display: "swap",
});

export const metadata: Metadata = {
  // Necessaire pour que les images de partage sortent en URL absolue.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "ArtVibeCamer",
    template: "%s — ArtVibeCamer",
  },
  description:
    "La scène des talents camerounais. Inscriptions des candidats, votes du public et billetterie de l’événement.",
  openGraph: {
    title: "ArtVibeCamer",
    description: "La scène des talents camerounais.",
    locale: "fr_CM",
    type: "website",
  },
};

export const viewport: Viewport = {
  // Le fond du site : la barre du navigateur mobile se fond dans l'entete.
  themeColor: "#002612",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${bricolage.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
