# ArtVibeCamer — API

API REST de la plateforme ArtVibeCamer : inscriptions des candidats, votes
payants, billetterie et back-office de l'organisation.

Laravel 13 · PHP 8.4 · MySQL / MariaDB · Sanctum

## Demarrage

```bash
composer install
cp .env.example .env
php artisan key:generate
# renseigner DB_* dans .env
php artisan migrate --seed
php artisan storage:link
php artisan serve
```

> **XAMPP / LAMPP** : MariaDB y est servie par son propre socket. Ajouter
> `DB_SOCKET=/opt/lampp/var/mysql/mysql.sock` dans `.env`, sinon la connexion
> echoue meme avec `DB_HOST=127.0.0.1`.

Le seeder cree les categories, les categories de billets, les reglages de
l'evenement et un compte super administrateur. En local, le mot de passe est
`password` ; hors local il est genere aleatoirement et affiche une seule fois.

## Tests

```bash
php artisan test
```

Base dediee a creer une fois :

```sql
CREATE DATABASE artvibecamer_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## Organisation

```
app/
├── Enums/        Statuts du domaine (transactions, candidats, votes, billets, roles)
├── Http/
│   ├── Controllers/Api/V1/Site/    Espace public
│   ├── Controllers/Api/V1/Admin/   Back-office
│   ├── Requests/                   Validation
│   ├── Resources/                  Formatage des reponses
│   └── Middleware/                 Controle des capacites par role
├── Models/
├── Rules/        Validation des numeros mobiles camerounais
├── Services/
│   ├── Payments/     Passerelles, orchestration, delivrance des contreparties
│   ├── Registration/
│   ├── Voting/
│   ├── Ticketing/
│   └── Reporting/    Agregats du tableau de bord
└── Support/      Journal d'audit
```

La logique metier vit dans `Services/`. Les controleurs valident, deleguent et
formatent.

## Commandes

```bash
php artisan user:create                      # Compte back-office ou agent de scan
php artisan payments:reconcile               # Verifier les paiements en attente
php artisan counters:recalculate --dry-run   # Controler les compteurs de votes
```

## Passerelle de paiement

`PAYMENT_DRIVER` :

- `fake` — developpement hors ligne, aucun debit. Tout numero finissant par
  `0` simule un refus. **Refuse en production.**
- `elgiopay` — la passerelle reelle, MTN Mobile Money et Orange Money.

Pour Elgiopay, renseigner `ELGIOPAY_BASE_URL` (`sandbox-api.elgiopay.com` en
test), le couple de cles de l'application et le secret de signature :

| Variable | Role |
| --- | --- |
| `ELGIOPAY_SECRET_KEY` | `sk_...` — authentifie les appels serveur. A traiter comme un mot de passe |
| `ELGIOPAY_PUBLIC_KEY` | `pk_...` — parcours cote navigateur, inutilisee pour l'instant |
| `ELGIOPAY_AUTH_KEY` | `secrete` ou `publique` — laquelle des deux part en jeton Bearer |
| `ELGIOPAY_WEBHOOK_SECRET` | `whsec_...` — sans lui, toute notification est refusee |

`ELGIOPAY_AUTH_KEY` vaut `secrete` par defaut, conformement a leur
documentation. Leur bac a sable refusant cette cle en 401 au 10 octobre 2026,
le poste de developpement est sur `publique` : a rebasculer des qu'ils
corrigent, c'est une ligne.

Une cle n'authentifie que l'hote de son environnement : une cle `..._test_...`
est refusee sur `api.elgiopay.com`, et l'inverse. `php artisan
elgiopay:diagnostic` controle cette coherence avant le premier appel.

L'URL de notification se declare **dans le tableau de bord Elgiopay** :
`https://<domaine>/api/v1/webhooks/payments/elgiopay`.

Les numeros de test du bac a sable sont listes dans
[../docs/JOURNAL.md](../docs/JOURNAL.md).

## Documentation

- [../docs/API.md](../docs/API.md) — contrat d'API
- [../docs/DATABASE.md](../docs/DATABASE.md) — schema de la base
- [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) — choix techniques
- [../docs/JOURNAL.md](../docs/JOURNAL.md) — etat d'avancement
