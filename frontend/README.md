# ArtVibeCamer — Site et back-office

Interface publique de l'evenement ArtVibeCamer et back-office de
l'organisation.

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4

## Demarrage

```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
```

L'API Laravel doit tourner en parallele (`http://localhost:8000` par defaut).
Voir [../backend/README.md](../backend/README.md).

## Variables d'environnement

| Variable | Role |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Base de l'API Laravel, avec le prefixe `/api/v1` |
| `NEXT_PUBLIC_SITE_NAME` | Nom affiche avant le chargement des reglages |
| `NEXT_PUBLIC_SITE_URL` | URL publique, pour les metadonnees et le partage |

## Conventions

- Tous les appels API passent par `src/lib/api.ts`. Pas de `fetch` disperse
  dans les composants, sinon la gestion des erreurs et du jeton se duplique.
- Types derives de [../docs/API.md](../docs/API.md).
- Composants serveur par defaut ; `"use client"` seulement pour les
  formulaires, l'etat local et le suivi des paiements.
- Montants affiches avec un espace separateur de milliers : `15 000 FCFA`.

## Parcours de paiement

Les trois flux payants (inscription, votes, billets) suivent la meme
sequence :

1. `POST` de creation, qui renvoie une `transaction.reference` et un objet
   `payment`
2. afficher `payment.instructions`, ou rediriger vers `payment.redirect_url`
   s'il est present
3. interroger `GET /payments/{reference}` toutes les 3 a 5 secondes jusqu'a
   `is_final: true`

A ecrire une seule fois en composant partage.

## Etat d'avancement

Voir [../docs/JOURNAL.md](../docs/JOURNAL.md).
