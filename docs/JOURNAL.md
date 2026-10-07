# Journal de bord

Etat d'avancement du projet, point d'arret et suite a donner.
**A lire avant toute reprise du code, et a mettre a jour a chaque fin de
session.** C'est ce fichier qui permet a quelqu'un d'autre de reprendre sans
avoir a reconstituer le contexte.

- **Echeance MVP** : 10 octobre 2026
- **Derniere mise a jour** : 7 octobre 2026 (fin de journee)

---

## Ou on en est

**Le backend est complet et teste.** **Le parcours d'inscription avec paiement
et le suivi par l'organisation sont utilisables de bout en bout**, du
formulaire public jusqu'a la validation du dossier dans le back-office.

Les votes et la billetterie existent cote API mais n'ont pas encore
d'interface : c'est le prochain chantier, decide avec l'organisation pour
tenir l'echeance.

| Module | Backend | Interface |
| --- | --- | --- |
| Architecture, base de donnees | Fait | — |
| Inscription individuelle + paiement | Fait | **Fait** |
| Inscription en groupe, membres declares | Fait | **Fait** |
| Suivi du paiement par le candidat | Fait | **Fait** |
| Relance d'un paiement echoue | Fait | **Fait** |
| Connexion back-office | Fait | **Fait** |
| Tableau de bord, statistiques | Fait | **Fait** |
| Liste et fiche des candidats | Fait | **Fait** |
| Validation / rejet des dossiers | Fait | **Fait** |
| Suivi des paiements, verification | Fait | **Fait** |
| Recettes brut / commission / net | Fait | **Fait** |
| Liste et fiche publiques des candidats | Fait | **Fait** |
| Identite visuelle et logos | — | **Fait** |
| Exports CSV | Fait | Lien pose |
| Categories et candidats (pages publiques) | Fait | A faire |
| Votes payants | Fait | A faire |
| Billetterie + QR | Fait | A faire |
| Controle a l'entree | Fait | A faire |
| Gestion des categories et tarifs | Fait | A faire |
| Reglages de l'evenement | Fait | A faire |

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
| `Services/Payments/Drivers/*.php` | `fake` (hors ligne) et `elgiopay` (reel), derriere l'interface `PaymentGateway` |
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

Dernier etat : inscription payante et suivi par l'organisation termines et
verifies a l'ecran. **Rien n'a ete commence sur les votes, la billetterie et
le controle a l'entree cote interface.**

Pour repartir d'une base propre :

```bash
cd backend && php artisan migrate:fresh --seed
cd ../frontend && npm run dev
```

Compte de travail en local : `admin@artvibecamer.cm` / `password`.

### Ce que l'interface couvre deja

| Page | Chemin |
| --- | --- |
| Accueil, disciplines et tarifs | `/` |
| Formulaire d'inscription | `/inscription` |
| Suivi du paiement, relance en cas d'echec | `/paiement/[reference]` |
| Connexion de l'equipe | `/connexion` |
| Tableau de bord | `/admin` |
| Liste des candidats, filtres, recherche | `/admin/candidats` |
| Fiche candidat, validation et rejet | `/admin/candidats/[id]` |
| Suivi des paiements, verification | `/admin/paiements` |

## Suite a donner, par ordre de priorite

### 0. Mise en ligne — l'echeance du 10 octobre

Les inscriptions ouvrent le 10 octobre. Le parcours est termine et valide :
**ce qui reste n'est pas du code, c'est un deploiement.**

- [ ] Identifiants Elgiopay de production (`pk_live_`, `whsec_`)
- [ ] Hebergement et domaine, en HTTPS
- [ ] Entree cron pour `schedule:run` — sans elle, `payments:reconcile` ne
      tourne pas et les paiements dont la notification se perd restent bloques
- [ ] Sauvegardes automatiques de la base
- [ ] Comptes nominatifs pour l'equipe, et suppression du compte du seeder
- [ ] **Un paiement reel de bout en bout avant l'ouverture.** Le bac a sable
      ne simule pas les echecs : le premier vrai refus d'operateur sera
      decouvert en production.

### 1. Votes payants — prochain chantier

L'API est prete (`POST /candidates/{slug}/votes`). Il manque les pages :

1. **Liste publique des candidats** (`GET /candidates`), avec filtre par
   categorie et recherche.
2. **Page d'un candidat** (`GET /candidates/{slug}`) : photo, numero,
   presentation, nombre de voix, bouton « Voter ».
3. **Achat de voix** : choix de la quantite, numero Mobile Money. N'envoyer
   que `quantity` et `voter_phone`, jamais de montant.
4. **Page resultats** (`GET /results`) : gerer le `403` quand les resultats
   ne sont pas publies, et `votes_count: null` quand les scores sont masques.

Le composant `SuiviPaiement` se reutilise tel quel pour l'encaissement : les
trois flux partagent la meme sequence.

### 2. Billetterie et controle a l'entree

1. Liste des categories de billets, panier, commande.
2. Page de recuperation des billets (`/billets/{reference}`) qui encode
   `qr_token` en QR code.
3. **Ecran de scan** pour l'entree : camera, `POST /admin/scan`, verdict en
   grand. Il sera utilise debout, dans le bruit, sur un telephone — gros
   caracteres, couleur franche, retour sonore.

### 2 bis. Back-office, ce qui reste

Gestion des categories et des tarifs, categories de billets, annulation de
lots de votes suspects, ecran de reglages. Les routes existent toutes.

### 3. Avant la mise en production — non negociable

- [ ] **Credentials Elgiopay.** Renseigner `ELGIOPAY_API_KEY` (`pk_live_…`),
      `ELGIOPAY_WEBHOOK_SECRET` (`whsec_…`) et basculer `ELGIOPAY_BASE_URL`
      sur `https://api.elgiopay.com`. Le code est ecrit d'apres leur
      documentation et couvert par des tests, mais **n'a pas encore tourne
      contre un compte reel** : derouler d'abord le bac a sable.
- [ ] **Declarer l'URL de notification dans le tableau de bord Elgiopay** :
      `https://<domaine>/api/v1/webhooks/payments/elgiopay`. Elle ne se
      transmet pas par requete. Sans elle, aucun paiement ne se confirme tout
      seul — il faudrait passer par le bouton « Vérifier » du back-office.
- [ ] **Noter le secret de signature a sa creation.** Il n'est affiche
      qu'une fois, a la creation et apres chaque rotation.
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

### Installation des dependances du front

Sur une connexion instable, `npm install` abandonne en cours de route et
laisse des fichiers **tronques** dans `node_modules`. Cela se manifeste plus
tard par des erreurs incomprehensibles : une erreur de syntaxe dans
`csstype`, ou un « Bus error » au build quand c'est un binaire natif
(`@next/swc-linux-x64-gnu`) qui est atteint.

Un `.npmrc` est versionne avec des delais etendus et `maxsockets=3`. En cas de
doute sur l'integrite d'une dependance native :

```bash
node -e "require('@next/swc-linux-x64-gnu')"   # plante = binaire corrompu
```

### next/headers ne franchit pas la frontiere client

`src/lib/api.ts` importe `next/headers` et porte `import "server-only"` : il
ne peut etre importe que depuis un composant serveur. L'URL publique de l'API
vit donc dans `src/lib/config.ts`, que les composants client utilisent.
Importer `api.ts` depuis un composant client casse le build.

### Limites de debit et rendu serveur

Les pages publiques sont rendues cote serveur. Sans precaution, Laravel verrait
l'adresse du serveur Next pour **tous** les visiteurs et ses plafonds par IP
bloqueraient l'ensemble du public. Le front transmet donc `X-Forwarded-For`,
et Laravel ne lui fait confiance que pour les adresses listees dans
`TRUSTED_PROXIES`. Cette variable doit etre renseignee en production, et ne
doit jamais valoir `*`.

Corollaire : les ecritures declenchees par le visiteur (inscription, relance
de paiement, suivi) partent **directement du navigateur** vers l'API, pour que
l'adresse vue soit la sienne sans dependre de cette configuration.

### Quatre categories, deux tarifs

Danse, Chant et Comedie se presentent en individuel (8 000 FCFA) ou en groupe
(10 000 FCFA). Miss & Master est individuel uniquement, a 10 000 FCFA : son
`group_fee` reste a `NULL`, ce qui ferme la formule groupe partout, du
formulaire jusqu'au service.

Le tarif n'est jamais lu dans la requete : `Category::feeFor()` le calcule a
partir de la categorie et de la formule. Un montant envoye par le navigateur
est ignore, et un test le verifie.

### Deux facons de tester un paiement

**Hors ligne**, avec `PAYMENT_DRIVER=fake` : tout numero **finissant par 0**
declenche un refus, les autres aboutissent immediatement. Pratique sans
connexion ; a savoir pour ne pas croire a un bug quand un test echoue avec un
numero en `...0`.

**Contre le bac a sable Elgiopay**, avec `PAYMENT_DRIVER=elgiopay`, une cle
`pk_test_…` et `ELGIOPAY_BASE_URL=https://sandbox-api.elgiopay.com`. Le
resultat depend du numero du payeur :

| Numero Orange / MTN | Resultat |
| --- | --- |
| `699000000` / `677000000` | Paye immediatement |
| `699000010` / `677000010` | Paye apres 10 secondes |
| `699000030` / `677000030` | Paye apres 30 secondes |
| `699000060` / `677000060` | Paye apres 1 minute |
| `699000120` / `677000120` | Paye apres 2 minutes |
| `699000201` / `677000201` | Refus du payeur sur son telephone |
| `699000202` / `677000202` | Solde insuffisant |
| `699000203` / `677000203` | Pas valide a temps |
| `699000204` / `677000204` | Echec generique |

Tout autre numero aboutit immediatement.

Une commande deroule toute cette table d'un coup :

```bash
php artisan elgiopay:diagnostic           # tous les scenarios
php artisan elgiopay:diagnostic --rapide  # sans les confirmations differees
```

Elle verifie d'abord la cle par une lecture du solde. Sans ce controle, une
cle refusee ferait echouer tous les appels et les scenarios qui attendent un
echec s'afficheraient « OK » — une integration donnee pour bonne alors
qu'elle ne s'authentifie meme pas.

Rien n'est ecrit en base : les transactions sont construites en memoire, pour
ne pas gonfler les recettes du tableau de bord avec des essais.

**Les numeros a delai sont les plus utiles** : ils renvoient d'abord
`pending`, ce qui permet de verifier pour de vrai l'ecran d'attente du
candidat, l'interrogation du statut, et l'arrivee de la notification.

### Ecarts constates entre la documentation Elgiopay et leur API

Releves le **7 octobre 2026** sur `sandbox-api.elgiopay.com`, avec une cle
`pk_test_`. A reverifier avant la mise en service, et a signaler a Elgiopay.

| Point | Documentation | Comportement reel |
| --- | --- | --- |
| `GET /balance` | Objet enveloppe dans `data`, champs `pending_balance` et `total_balance`, valeurs numeriques | Champs **au premier niveau**, nommes `reserved_balance` et `balance`, valeurs en **chaines decimales** (« 78400.00 ») |
| Numeros d'echec `…201` a `…204` | `status: failed` avec un `error_code` en 9200 | **Aboutissent tous** en `completed` |
| Numeros a delai `…010`, `…060` | `pending` puis bascule apres 10 s / 1 min | **Aboutissent en une seconde** |

`ElgiopayGateway::balance()` lit les deux formes, pour ne pas casser le jour
ou ils les alignent.

Les deux dernieres lignes signifient qu'**on ne peut pas valider le parcours
d'echec contre leur bac a sable**. Notre traitement est couvert par
`tests/Feature/ElgiopayTest.php`, avec des reponses forgees — mais tant
qu'Elgiopay n'a pas corrige son simulateur, le comportement reel face a un
refus d'operateur reste a confirmer.

### Commission et tresorerie

Observe sur une transaction reelle du bac a sable : **8 000 FCFA encaisses,
160 FCFA de frais, 7 840 FCFA nets — soit 2 %.** A confirmer aupres
d'Elgiopay : le taux est-il identique sur MTN et Orange, et s'applique-t-il
aussi au retrait ?

L'argent ne part pas sur un compte Mobile Money : il s'accumule sur le solde
Elgiopay jusqu'a un retrait explicite (`POST /payouts` ou leur tableau de
bord).

La commission est desormais conservee sur chaque transaction (`fees`,
`net_amount`) et le tableau de bord distingue les trois chiffres : net recu,
encaisse brut, commission. Le net passe en premier, c'est celui qu'on
communique a l'organisateur et aux sponsors.

Les deux colonnes sont nullables : la simulation et les encaissements hors
ligne ne produisent pas de frais, et le net retombe alors sur le brut plutot
que de compter zero.

### Ne pas saturer la passerelle

Signale par Elgiopay : notre integration generait trop d'appels par seconde.

La cause n'etait pas le diagnostic mais **l'ecran d'attente du candidat** :
il interrogeait notre API toutes les 4 secondes, et chaque interrogation
repercutait un appel chez eux. A cent inscriptions simultanees, cela faisait
une vingtaine d'appels par seconde pour une information qui ne change
qu'une fois.

Trois reglages encadrent desormais la charge :

| Reglage | Defaut | Role |
| --- | --- | --- |
| `PAYMENT_VERIFICATION_INTERVAL` | 25 s | Intervalle minimal entre deux verifications d'une meme transaction |
| `ELGIOPAY_MAX_RPS` | 4 | Plafond d'appels sortants par seconde, tous processus confondus |
| Cadence du front | 4 s → 8 s → 15 s | S'allonge au fil de l'attente |

Si Elgiopay signale a nouveau une charge excessive, **baisser
`ELGIOPAY_MAX_RPS` avant tout le reste** : c'est le plafond dur, les deux
autres ne font que reduire le nombre d'appels candidats.

### Les notifications ne se configurent pas par requete

L'URL de webhook se declare **dans le tableau de bord Elgiopay**, pas dans
l'appel `POST /payments`. Si les paiements restent bloques en « en cours »
alors que l'argent est debite, c'est la premiere chose a verifier.

Pour tester en local, exposer le poste avec un tunnel (`ngrok`, `cloudflared`)
et declarer l'URL publique obtenue.

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
