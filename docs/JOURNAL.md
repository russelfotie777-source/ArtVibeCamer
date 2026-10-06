# Journal de bord

Etat d'avancement du projet, point d'arret et suite a donner.
**A lire avant toute reprise du code, et a mettre a jour a chaque fin de
session.** C'est ce fichier qui permet a quelqu'un d'autre de reprendre sans
avoir a reconstituer le contexte.

- **Echeance MVP** : 10 octobre 2026
- **Derniere mise a jour** : 7 octobre 2026

---

## Ou on en est

**Le backend est fonctionnel de bout en bout.** Les trois parcours payants
(inscription, votes, billets) tournent, le controle a l'entree fonctionne, le
tableau de bord renvoie ses chiffres. 27 tests automatises passent.

**Le frontend n'est pas commence.** Le squelette Next.js existe avec ses
dependances installees, rien de plus.

| Module | Backend | Frontend |
| --- | --- | --- |
| Architecture, base de donnees | Fait | — |
| Categories et candidats | Fait | A faire |
| Inscription + paiement | Fait | A faire |
| Votes payants | Fait | A faire |
| Billetterie + QR | Fait | A faire |
| Controle a l'entree | Fait | A faire |
| Tableau de bord, statistiques | Fait | A faire |
| Exports CSV | Fait | — |
| Interface publique | — | A faire |
| Back-office | — | A faire |

---

## Ce qui est fait, en detail

### Base de donnees

13 migrations, verifiees sur MariaDB 10.4. Schema documente table par table
dans [DATABASE.md](DATABASE.md).

Seeders : 8 categories de depart (tarifs 10 000 / 12 500 / 15 000 FCFA),
3 categories de billets (Standard 5 000, VIP 15 000, VVIP 50 000),
15 reglages d'evenement, 1 compte super administrateur.

### API

47 routes sous `/api/v1`, contrat complet dans [API.md](API.md).

Couche metier organisee en services :

| Fichier | Role |
| --- | --- |
| `Services/Payments/PaymentProcessor.php` | **Coeur du systeme.** Seul chemin de changement d'etat d'un paiement. Idempotent, atomique, verrouille |
| `Services/Payments/Fulfilment/*.php` | Delivrance des contreparties : numero de candidat, voix, billets |
| `Services/Payments/Drivers/*.php` | `fake`, `campay`, `cinetpay` derriere l'interface `PaymentGateway` |
| `Services/Registration/RegistrationService.php` | Creation du dossier + encaissement des frais |
| `Services/Voting/VoteService.php` | Achat et annulation de lots de voix |
| `Services/Ticketing/TicketingService.php` | Commande, reservation de jauge |
| `Services/Ticketing/TicketScanner.php` | Controle a l'entree |
| `Services/Reporting/StatsService.php` | Agregats du tableau de bord |

### Tests

```bash
cd backend && php artisan test
# 27 tests, 110 assertions
```

Ils couvrent volontairement les invariants d'argent plutot que du CRUD :

- une inscription payee recoit un numero, un paiement refuse n'en recoit pas ;
- les numeros de candidat sont sequentiels par categorie ;
- les voix ne sont creditees qu'apres paiement ;
- le montant est calcule par le serveur, un prix envoye par le client est
  ignore ;
- **rejouer 4 fois une notification de paiement ne recompte pas les voix** ;
- un meme `event_id` n'est enregistre qu'une fois ;
- l'annulation d'un lot retire les voix du compteur ;
- un billet ne peut etre scanne qu'une fois ;
- la jauge ne peut pas etre depassee, le tarif est fige a la commande ;
- un agent de scan n'accede a rien d'autre que le scan ;
- les donnees personnelles des candidats ne sortent pas vers le public.

### Verifie manuellement

Parcours complet deroule contre le serveur local : inscription Musique
(15 000 FCFA) → numero `AVC-MUS-001` attribue → validation back-office →
achat de 25 voix (2 500 FCFA) → commande de 3 billets (35 000 FCFA) →
3 billets emis avec QR → scan accepte puis refuse au second passage →
tableau de bord affichant 50 000 FCFA de recettes.

---

## Point d'arret precis

Dernier etat : backend termine et teste, **frontend non commence**.

Le serveur de developpement tournait sur `http://127.0.0.1:8000`.
La base `artvibecamer` contient des donnees de test (1 candidat, 1 lot de
votes, 1 commande de billets). Pour repartir propre :

```bash
cd backend && php artisan migrate:fresh --seed
```

---

## Suite a donner, par ordre de priorite

### 1. Frontend public — le plus urgent

Rien n'existe. C'est le chemin critique vers l'echeance.

Ordre suggere, du plus structurant au moins :

1. **Client API et types TypeScript** (`src/lib/api.ts`). Point d'entree
   unique vers le backend, types derives de [API.md](API.md). Tout le reste en
   depend.
2. **Page d'accueil** : nom et accroche de l'evenement depuis
   `GET /settings`, liste des categories, appels a l'action vers inscription /
   vote / billetterie.
3. **Liste et fiche candidat** : `GET /candidates`, `GET /candidates/{slug}`.
   La fiche porte le bouton « Voter ».
4. **Parcours de paiement reutilisable.** Les trois flux suivent exactement la
   meme sequence : `POST` de creation → afficher `payment.instructions` ou
   rediriger vers `payment.redirect_url` → interroger
   `GET /payments/{reference}` toutes les 3 a 5 secondes jusqu'a
   `is_final: true`. **A ecrire une fois en composant partage**, pas trois
   fois.
5. **Formulaire d'inscription** : `multipart/form-data` a cause de la photo.
6. **Achat de votes** : n'envoyer que `quantity` et `voter_phone`.
7. **Billetterie** : panier, `POST /ticket-orders`, puis page de recuperation
   des billets a `/billets/{reference}` qui encode `qr_token` en QR code.
8. **Page resultats** : `GET /results`. Gerer les deux cas — `403` si les
   resultats ne sont pas publies, `votes_count: null` si les scores sont
   masques.

### 2. Back-office

1. Connexion (`POST /admin/login`), jeton stocke cote client.
2. Tableau de bord : les six blocs de `GET /admin/dashboard` sont deja
   calcules, il n'y a qu'a les afficher. Mettre `alerts` en evidence.
3. Liste des candidats avec filtres, boutons valider / rejeter.
4. Gestion des categories et des tarifs.
5. Suivi des paiements, avec le bouton « verifier » (`POST
   /admin/transactions/{reference}/verify`).
6. Ecran de scan : camera, appel a `POST /admin/scan`, verdict en grand et
   lisible. **Cet ecran sera utilise debout, dans le bruit, sur un telephone**
   — gros caracteres, couleur franche, retour sonore.
7. Reglages : les interrupteurs de `PUT /admin/settings`.

### 3. Avant la mise en production — non negociable

- [ ] **Credentials Mobile Money.** Reverifier les chemins et les champs des
      drivers `campay` et `cinetpay` sur la documentation en vigueur, et
      tester sur leur environnement de demo. Les implementations suivent la
      structure habituelle de ces API mais n'ont jamais vu un compte reel.
- [ ] **`PAYMENT_DRIVER` ne doit pas valoir `fake`.** `PaymentManager` leve
      une exception si `APP_ENV=production`, mais verifier quand meme.
- [ ] **Sauvegardes automatiques de la base.** Rien n'est en place. Une base
      contenant des encaissements sans sauvegarde est un risque qu'on ne peut
      pas porter le soir de l'evenement.
- [ ] **Entree cron** pour `schedule:run` — sinon `payments:reconcile` ne
      tourne pas, et un paiement dont la notification est perdue reste bloque.
      ```
      * * * * * cd /chemin/du/projet/backend && php artisan schedule:run >> /dev/null 2>&1
      ```
- [ ] `APP_DEBUG=false`, `APP_ENV=production`, HTTPS.
- [ ] Changer le mot de passe du compte seeder, ou le supprimer au profit de
      comptes nominatifs crees par `php artisan user:create`.
- [ ] Verifier `FRONTEND_URL` : il pilote les origines CORS autorisees.
- [ ] `php artisan counters:recalculate --dry-run` **avant la proclamation des
      resultats**.

### 4. Ameliorations utiles, apres le MVP

- Envoi du billet par email et WhatsApp (`ticket_orders.delivered_at` et
  `delivery_channel` sont deja prevus en base, rien n'est branche).
- Generation d'un PDF de billet.
- Notification du candidat a la validation de son dossier.
- Compte candidat permettant de suivre ses propres voix.
- Pagination par curseur sur `/admin/votes` si le volume devient important.

---

## Pieges connus

Les points suivants ont deja coute du temps. Les lire evite de les
redecouvrir.

### MariaDB sous XAMPP

Le `mysql` du PATH pointe sur `/run/mysqld/mysqld.sock`, qui n'existe pas
quand la base est servie par XAMPP. Resultat : « Can't connect to local
server through socket », meme avec `DB_HOST=127.0.0.1`.

```bash
# Client
/opt/lampp/bin/mysql -u root --socket=/opt/lampp/var/mysql/mysql.sock
# .env
DB_SOCKET=/opt/lampp/var/mysql/mysql.sock
```

### Ne pas cacher d'objet avec le driver de cache `database`

Un objet serialise porte des octets NUL pour marquer ses proprietes
protegees. Ces octets ne survivent pas a un aller-retour dans la colonne texte
du cache : la valeur relue devient un `__PHP_Incomplete_Class` et tout casse.

`Setting::cached()` renvoie donc un **tableau associatif**, pas une
`Collection`. Ne pas revenir en arriere.

### Champs volontairement hors `$fillable`

`candidate_number` et `votes_count` ne sont pas mass-assignables : seuls le
fulfilment d'un paiement et les increments de vote y touchent. Si un
`MassAssignmentException` apparait sur ces champs, **ce n'est pas un bug du
modele** — c'est le garde-fou qui fonctionne. Utiliser `forceFill()` dans les
tests, et passer par le service metier dans le code applicatif.

### Les garde-fous Eloquent sont actifs hors production

`preventLazyLoading` et `preventSilentlyDiscardingAttributes` sont actives en
dev et en test. Une relation non chargee ou un attribut non fillable leve une
exception. C'est voulu : ces erreurs-la, en production, donnent des requetes
N+1 ou des ecritures partielles silencieuses sur des montants.

### Total des voix

Le total des voix d'un candidat est
`SUM(quantity) WHERE status = 'confirmed'`, **pas** `COUNT(*)` : une ligne de
`votes` represente un lot de plusieurs voix. Erreur facile a faire en
ajoutant une statistique.

### Binding des routes

Les modeles exposes au public se resolvent par `slug` ou `reference`. Le
back-office travaille sur des identifiants numeriques, d'ou les
`{candidate:id}` explicites dans la partie admin de `routes/api.php`. Oublier
le `:id` donne un 404 silencieux.

### Simulation d'un echec de paiement

Avec `PAYMENT_DRIVER=fake`, tout numero **finissant par 0** declenche un
refus. Pratique pour tester le parcours d'echec ; a savoir pour ne pas croire
a un bug quand un test echoue avec un numero en `...0`.

---

## Decisions prises, et pourquoi

Le raisonnement complet est dans [ARCHITECTURE.md](ARCHITECTURE.md). En
resume :

| Decision | Raison courte |
| --- | --- |
| Montants en entiers de FCFA | Devise sans sous-unite, aucun `float` ne touche a un montant |
| Une seule table `transactions` | Recettes consolidees en un `GROUP BY`, reconciliation unique avec l'operateur |
| Rien n'est delivre avant paiement | Un billet en base est un billet paye, une voix comptee est une voix payee |
| Passerelles derriere une interface | Developper sans attendre les credentials, changer d'operateur sans toucher au metier |
| Compteurs de votes denormalises | Le classement est la page la plus consultee ; `counters:recalculate` fait foi en cas de doute |
| Scan par `UPDATE` conditionnel | Deux agents scannant le meme billet au meme instant : une seule entree autorisee |
| Reservation de jauge | Eviter d'encaisser deux acheteurs pour la meme derniere place |
| Aucun blocage automatique sur IP | Une connexion partagee peut masquer des centaines de votants legitimes ; bloquer reviendrait a refuser de l'argent reel |
| Pas de page de creation de compte | Le back-office donne acces aux recettes et aux donnees personnelles |
| Tests sur MySQL et non SQLite | Le schema s'appuie sur des comportements propres a MySQL/MariaDB (verrous, ENUM) |

---

## Comment reprendre

```bash
# Backend
cd backend
composer install
cp .env.example .env && php artisan key:generate
# renseigner DB_* (et DB_SOCKET sous XAMPP)
php artisan migrate --seed
php artisan storage:link
php artisan serve

# Verifier que tout va bien
php artisan test

# Frontend
cd ../frontend
npm install
npm run dev
```

Compte de travail en local : `admin@artvibecamer.cm` / `password`.
