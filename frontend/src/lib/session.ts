"use server";

import { cookies } from "next/headers";
import { COOKIE_SESSION } from "./api";

/*
 * Le jeton Sanctum est pose dans un cookie httpOnly. Une faille XSS sur une
 * page du back-office ne peut donc pas l'exfiltrer, ce qui serait le risque
 * d'un stockage dans localStorage sur une interface donnant acces aux
 * recettes et aux donnees personnelles des candidats.
 */

const DUREE = 60 * 60 * 12; // 12 h, soit une journee de travail

export async function ouvrirSession(jeton: string): Promise<void> {
  const magasin = await cookies();

  magasin.set(COOKIE_SESSION, jeton, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DUREE,
  });
}

export async function fermerSession(): Promise<void> {
  const magasin = await cookies();
  magasin.delete(COOKIE_SESSION);
}
