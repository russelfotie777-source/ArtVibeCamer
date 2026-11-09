import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

/*
 * Une seule famille. Bricolage Grotesque a un dessin legerement irregulier,
 * presque taille, qui fait echo a la broderie du toghu. Son axe de taille
 * optique (opsz, 12 a 96) lui donne une coupe de texte sobre a 14 px et une
 * coupe d'affiche serree a 96 px : elle tient les deux roles sans seconde
 * fonte. Son axe de chasse (wdth) ne sert qu'au titre d'accueil.
 */
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz", "wdth"],
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
