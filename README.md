# ArtVibeCamer

Plateforme web de l'evenement ArtVibeCamer : mise en avant de la culture, des
talents et de l'art camerounais. Le site centralise la gestion complete de
l'evenement — inscription des candidats, votes payants, billetterie et suivi
par l'organisation.

## Fonctionnalites

| Module | Contenu |
| --- | --- |
| Inscriptions | Formulaire par categorie, frais de 10 000 a 15 000 FCFA, paiement en ligne, numero de candidat attribue a la confirmation du paiement |
| Categories | Liste publique, nombre de candidats, fiche de chaque candidat |
| Votes | Achat de voix payantes, classement dynamique, garde-fous anti-fraude |
| Billetterie | Vente en ligne, billet electronique avec QR code, controle a l'entree |
| Back-office | Tableau de bord, validation des dossiers, suivi des paiements, exports CSV |

## Stack

- **Backend** — Laravel 13 (API REST), PHP 8.4, authentification par jetons Sanctum
- **Base de donnees** — MySQL / MariaDB
- **Frontend** — Next.js 16 (App Router), TypeScript, Tailwind CSS 4
- **Paiement** — Mobile Money Cameroun (MTN MoMo, Orange Money) derriere une
  interface de passerelle interchangeable

Les deux applications sont independantes et communiquent uniquement par l'API
documentee dans [docs/API.md](docs/API.md). Chacun peut donc avancer de son
cote sans bloquer l'autre.

```
ArtVibeCamer/
├── backend/     API Laravel
├── frontend/    Site et back-office Next.js
└── docs/        Architecture, schema, contrat d'API, journal de bord
```

## Documentation

| Fichier | Quand le lire |
| --- | --- |
| [docs/JOURNAL.md](docs/JOURNAL.md) | **A lire en premier** : etat d'avancement, ou en est chaque module, quoi faire ensuite |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Choix techniques et leurs raisons |
| [docs/DATABASE.md](docs/DATABASE.md) | Schema de la base, table par table |
| [docs/API.md](docs/API.md) | Contrat d'API : routes, parametres, reponses |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Conventions de code, branches et commits |

## Installation

### Prerequis

PHP 8.4+ avec `pdo_mysql`, Composer 2, Node.js 20+, MySQL 8 ou MariaDB 10.4+.

### Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Renseigner la connexion base de donnees dans `.env`, puis :

```bash
php artisan migrate --seed
php artisan storage:link
php artisan serve          # http://localhost:8000
```

Le seeder cree les categories de depart, les categories de billets et un
compte super administrateur. En local le mot de passe est `password` ; hors
local il est genere aleatoirement et affiche une seule fois.

> **XAMPP / LAMPP** : MariaDB y est servie par son propre socket. Ajouter
> `DB_SOCKET=/opt/lampp/var/mysql/mysql.sock` dans `.env`, sinon la connexion
> echoue meme avec `DB_HOST=127.0.0.1`.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # renseigner NEXT_PUBLIC_API_URL
npm run dev                  # http://localhost:3000
```

### Tests

```bash
cd backend
php artisan test
```

Les tests tournent sur une base MySQL dediee (`artvibecamer_test`), a creer une
fois :

```sql
CREATE DATABASE artvibecamer_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## Commandes utiles

```bash
php artisan user:create            # Creer un compte back-office ou agent de scan
php artisan payments:reconcile     # Verifier les paiements restes en attente
php artisan counters:recalculate --dry-run   # Controler les compteurs de votes
```

## Paiement

Le driver actif est choisi par `PAYMENT_DRIVER` :

- `fake` — simulation locale, aucun appel reseau, aucun debit. Refuse en
  production.
- `campay` — collecte MTN MoMo et Orange Money par USSD direct.
- `cinetpay` — page de paiement hebergee (MoMo, Orange Money, carte).

Tant que les credentials de l'operateur ne sont pas disponibles, le driver
`fake` permet de developper et de tester l'integralite des parcours.
