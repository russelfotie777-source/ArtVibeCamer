import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import "./globals.css";

/*
 * Deux familles clairement distinctes. Bricolage Grotesque a un dessin
 * legerement irregulier, presque taille, qui fait echo a la broderie du
 * toghu ; sa largeur variable permet des titres tres resserres. Instrument
 * Sans tient les textes courants et les formulaires.
 */
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz", "wdth"],
});

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
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
    "La scene des talents camerounais. Inscriptions des candidats, votes du public et billetterie de l'evenement.",
  openGraph: {
    title: "ArtVibeCamer",
    description: "La scene des talents camerounais.",
    locale: "fr_CM",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f2d1c",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="fr"
      className={`${bricolage.variable} ${instrument.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
