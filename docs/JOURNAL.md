# Journal de bord

Etat d'avancement du projet, point d'arret et suite a donner.
**A lire avant toute reprise du code, et a mettre a jour a chaque fin de
session.** C'est ce fichier qui permet a quelqu'un d'autre de reprendre sans
avoir a reconstituer le contexte.

- **Echeance MVP** : 10 octobre 2026
- **Derniere mise a jour** : 10 octobre 2026

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
# 64 tests, 263 assertions
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

**10 octobre** : le compte Elgiopay est passe a un couple de cles par
application (`sk_` secrete, `pk_` publique). La configuration suit ce
decoupage, le bac a sable est renseigne, et le diagnostic refuse desormais de
partir sur une cle qui ne correspond pas a l'hote appele.

Le secret de signature `whsec_` est en place et verifie : trois notifications
rejouees en local contre notre propre endpoint, signature correcte acceptee,
signature falsifiee et horodatage d'une heure refuses.

**L'URL de notification n'est volontairement pas declaree**, le temps de
prendre un nom de domaine : elle demande une adresse publique stable, et un
tunnel change d'URL a chaque session. C'est tenable parce que le rattrapage
par interrogation couvre le meme besoin — voir « Se passer du webhook »
plus bas.

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

- [ ] Identifiants Elgiopay de production (`sk_live_`, `pk_live_`, `whsec_`),
      qui supposent l'approbation prealable de l'application par Elgiopay
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

- [ ] **Credentials Elgiopay.** Renseigner `ELGIOPAY_SECRET_KEY`
      (`sk_live_…`), `ELGIOPAY_PUBLIC_KEY` (`pk_live_…`),
      `ELGIOPAY_WEBHOOK_SECRET` (`whsec_…`) et basculer `ELGIOPAY_BASE_URL`
      sur `https://api.elgiopay.com`. Les cles de production ne sont
      delivrees **qu'apres approbation de l'application** par Elgiopay : la
      demander tot, ce n'est pas instantane. Le code est ecrit d'apres leur
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

**Contre le bac a sable Elgiopay**, avec `PAYMENT_DRIVER=elgiopay`, la cle
secrete `sk_test_…` dans `ELGIOPAY_SECRET_KEY` et
`ELGIOPAY_BASE_URL=https://sandbox-api.elgiopay.com`. Le
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
php artisan elgiopay:diagnostic                      # toute la batterie
php artisan elgiopay:diagnostic --rapide             # sans les confirmations differees
php artisan elgiopay:diagnostic --scenario=677000202 # un seul numero
```

**Cout mesure : 17 appels sur 73 secondes**, soit environ une requete toutes
les quatre secondes. La commande annonce son total a la fin — de quoi
repondre precisement si le fournisseur signale une charge excessive.

Utilisez `--scenario=` pour verifier un point precis. Rejouer toute la
batterie pour un seul cas multiplie la charge par huit sans rien apprendre de
plus.

Elle verifie d'abord la cle par une lecture du solde. Sans ce controle, une
cle refusee ferait echouer tous les appels et les scenarios qui attendent un
echec s'afficheraient « OK » — une integration donnee pour bonne alors
qu'elle ne s'authentifie meme pas.

Rien n'est ecrit en base : les transactions sont construites en memoire, pour
ne pas gonfler les recettes du tableau de bord avec des essais.

Depuis le 8 octobre, **tous ces numeros se comportent comme annonce**,
confirmations differees comprises.

**Les numeros a delai sont les plus utiles** : ils renvoient d'abord
`pending`, ce qui permet de verifier pour de vrai l'ecran d'attente du
candidat, l'interrogation du statut, et l'arrivee de la notification.

### Ecarts Elgiopay : signales le 7 octobre, corriges le 8

Trois ecarts avaient ete releves sur `sandbox-api.elgiopay.com` avec une cle
`pk_test_`. Signales a Elgiopay, **les deux premiers ont ete corriges le
lendemain** et verifies numero par numero.

| Point | Constate le 7 octobre | Etat |
| --- | --- | --- |
| Numeros d'echec `…201` a `…204` | Aboutissaient tous en `completed` | **Corrige.** Renvoient `failed` avec leur code |
| Numeros a delai `…010`, `…060` | Aboutissaient en une seconde | **Corrige.** 14 s et 1 min 4 s mesures |
| `GET /balance` | Champs au premier niveau, nommes `reserved_balance` et `balance`, valeurs en chaines decimales | Toujours different de la documentation |

`ElgiopayGateway::balance()` lit les deux formes et fonctionne : le solde
s'affiche correctement dans le diagnostic.

**Consequence pour le diagnostic** : les huit scenarios sont bloquants. Chacun
verifie un comportement reellement simule, et un ecart signale desormais une
regression — chez eux ou chez nous — et non une lacune connue.

**A retenir pour la suite** : un fournisseur corrige quand on lui envoie un
rapport precis, avec le numero concerne, la reponse obtenue et l'identifiant
de transaction. Le ton n'y est pour rien, la precision si.

### Orange n'etait verifie nulle part

Constate le 10 octobre en relisant la couverture : **tous les tests de la
passerelle passaient par un numero MTN.** Les numeros Orange n'apparaissaient
que dans les tests du driver de simulation, qui ne choisit aucun reseau.

La detection d'operateur elle-meme (`PaymentMethod::fromCameroonPhone`)
n'avait aucun test, alors que c'est elle qui decide du reseau de chaque
collecte. Une borne fausse, ou un `orange_money` mal orthographie, aurait
envoye **tous les payeurs Orange sur le reseau MTN** — un echec cote
operateur, apres notre reponse au candidat, donc invisible en developpement.

Trois tests comblent le trou :

| Test | Ce qu'il tient |
| --- | --- |
| `PaymentMethodTest` | Les deux plages et leurs frontieres : 654/655 et 684/685, le format international, les numeros hors plage |
| `test_un_numero_orange_part_sur_le_reseau_orange` | L'aller : un 699 produit bien `payment_method: orange_money` |
| `test_une_notification_orange_enregistre_le_bon_operateur` | Le retour : la notification Orange enregistre `OrangeMoney` sur la transaction |

Verifies par mutation : en remplacant `orange_money` par `mtn_mobile_money`
dans la correspondance, le test de l'aller echoue. Il tient donc vraiment la
regle, il ne se contente pas de passer.

**A retenir** : une couverture qui n'exerce qu'un operateur donne la meme
barre verte qu'une couverture complete. Ici la moitie des payeurs attendus
n'etait pas testee.

### Se passer du webhook : ce que cela coute

Tant qu'aucun nom de domaine n'est pris, l'URL de notification n'est pas
declaree chez Elgiopay. **Les paiements se confirment quand meme**, par deux
chemins qui interrogent la passerelle au lieu d'attendre qu'elle nous appelle :

| Chemin | Quand | Delai de confirmation |
| --- | --- | --- |
| Ecran d'attente du candidat | Tant que l'onglet est ouvert | 25 a 40 secondes |
| `payments:reconcile` | Toutes les 5 minutes, par le planificateur | 5 minutes au pire |
| Bouton « Verifier » du back-office | A la demande | immediat |

Aucun risque d'expirer un paiement reellement encaisse : `payments:reconcile`
redemande d'abord l'etat reel a la passerelle, et n'expire que ce qu'elle ne
reconnait toujours pas comme paye, 10 minutes apres le delai. Les frais et le
net sont lus par la meme correspondance que la notification, donc la
tresorerie reste juste.

**Deux conditions, sans lesquelles l'affirmation est fausse :**

1. **Le planificateur doit tourner.** En production c'est l'entree cron
   `schedule:run`, deja dans la checklist. En local, `demarrer.sh` ne le lance
   pas : ouvrir `php artisan schedule:work` dans un terminal, ou appeler
   `php artisan payments:reconcile` a la main. Sans lui, un candidat qui ferme
   son onglet reste bloque en « en cours » jusqu'a une verification manuelle.
2. **La charge sur la passerelle augmente.** C'est exactement ce qui nous
   avait ete signale : sans notification, chaque paiement en attente coute un
   appel toutes les 5 minutes, plus ceux de l'ecran d'attente. Acceptable a
   notre volume, a rouvrir des que le domaine existe.

Declarer l'URL reste donc **la premiere chose a faire a la mise en ligne**,
pas une option : `https://<domaine>/api/v1/webhooks/payments/elgiopay`.
Attention, le champ du tableau de bord propose `/webhooks/elgiopay` en
exemple — ce n'est pas notre chemin.

### Deux cles Elgiopay, une seule authentifie

Depuis le 10 octobre, le tableau de bord delivre un **couple de cles par
application** la ou il n'en donnait qu'une :

| Cle | Role |
| --- | --- |
| `sk_…` | Secrete. Elle seule authentifie nos appels serveur, et elle seule autorise a encaisser et a retirer. A traiter comme un mot de passe |
| `pk_…` | Publique. Prevue pour les parcours ou le navigateur s'adresse directement a la passerelle. Nous n'en sommes pas la : tout passe par notre API |

`ELGIOPAY_API_KEY` est donc remplace par `ELGIOPAY_SECRET_KEY` et
`ELGIOPAY_PUBLIC_KEY`. L'ancien nom reste lu en dernier recours, pour qu'un
environnement pas encore mis a jour ne tombe pas en panne sans explication.

**Premier piege** : la cle publique est la plus visible des deux et la plus
facile a copier. Placee dans `ELGIOPAY_SECRET_KEY`, elle fait echouer chaque
appel, et le candidat ne voit qu'un « paiement impossible » generique. Le
diagnostic previent maintenant quand la cle configuree ne commence pas par
`sk_`.

**Second piege** : une cle n'authentifie que l'hote de son environnement. Une
cle `…_test_…` est refusee par `api.elgiopay.com`, une cle `…_live_…` par
`sandbox-api.elgiopay.com`. Le diagnostic compare les deux avant le premier
appel et s'arrete net — sans quoi le symptome, « cle refusee », pointe vers
la mauvaise cause.

**Troisieme point** : renouveler une cle depuis le tableau de bord invalide
immediatement la precedente. A faire au moindre soupcon de fuite, mais en
sachant que les encaissements s'arretent jusqu'a la mise a jour du `.env`.

**Leur API n'accepte pas la cle qu'annonce leur tableau de bord.** Constate
le 10 octobre au soir, sur `GET /api/v1/balance`, hote
`sandbox-api.elgiopay.com`, avec les deux cles du meme couple :

| Cle envoyee en jeton Bearer | Reponse |
| --- | --- |
| `sk_test_…` (secrete) | **401** |
| `pk_test_…` (publique) | **200** |

Leur interface presente pourtant la cle secrete comme le credential serveur
(« Traitez les cles secretes comme des mots de passe »). Verifie deux fois,
cle recopiee par le bouton de copie, sans espace ni retour a la ligne.

D'ou `ELGIOPAY_AUTH_KEY` : `secrete` ou `publique`. Le defaut reste `secrete`,
qui est le reglage correct ; le poste de developpement est sur `publique`.
Le jour ou Elgiopay aligne son API sur son tableau de bord, c'est une ligne
de `.env` a changer, pas une relecture du driver.

Deux tests tiennent ce reglage, parce qu'il decide a lui seul qu'un paiement
aboutit : un par mode, avec le jeton attendu. Les suites fixent desormais
`auth_key` explicitement — sans cela elles suivaient le `.env` du poste et ne
donnaient pas le meme resultat d'une machine a l'autre.

**A faire** : le signaler a Elgiopay, avec le chemin, l'horodatage et les deux
statuts. C'est ce format qui leur avait fait corriger le bac a sable en
vingt-quatre heures le 8 octobre.

### Se passer du webhook : ce que cela coute

Tant qu'aucun nom de domaine n'est pris, l'URL de notification n'est pas
declaree chez Elgiopay. **Les paiements se confirment quand meme**, par deux
chemins qui interrogent la passerelle au lieu d'attendre qu'elle nous appelle :

| Chemin | Quand | Delai de confirmation |
| --- | --- | --- |
| Ecran d'attente du candidat | Tant que l'onglet est ouvert | 25 a 40 secondes |
| `payments:reconcile` | Toutes les 5 minutes, par le planificateur | 5 minutes au pire |
| Bouton « Verifier » du back-office | A la demande | immediat |

Aucun risque d'expirer un paiement reellement encaisse : `payments:reconcile`
redemande d'abord l'etat reel a la passerelle, et n'expire que ce qu'elle ne
reconnait toujours pas comme paye, 10 minutes apres le delai. Les frais et le
net sont lus par la meme correspondance que la notification, donc la
tresorerie reste juste.

**Deux conditions, sans lesquelles l'affirmation est fausse :**

1. **Le planificateur doit tourner.** En production c'est l'entree cron
   `schedule:run`, deja dans la checklist. En local, `demarrer.sh` ne le lance
   pas : ouvrir `php artisan schedule:work` dans un terminal, ou appeler
   `php artisan payments:reconcile` a la main. Sans lui, un candidat qui ferme
   son onglet reste bloque en « en cours » jusqu'a une verification manuelle.
2. **La charge sur la passerelle augmente.** C'est exactement ce qui nous
   avait ete signale : sans notification, chaque paiement en attente coute un
   appel toutes les 5 minutes, plus ceux de l'ecran d'attente. Acceptable a
   notre volume, a rouvrir des que le domaine existe.

Declarer l'URL reste donc **la premiere chose a faire a la mise en ligne**,
pas une option : `https://<domaine>/api/v1/webhooks/payments/elgiopay`.
Attention, le champ du tableau de bord propose `/webhooks/elgiopay` en
exemple — ce n'est pas notre chemin.

### Deux cles Elgiopay, une seule authentifie

Depuis le 10 octobre, le tableau de bord delivre un **couple de cles par
application** la ou il n'en donnait qu'une :

| Cle | Role |
| --- | --- |
| `sk_…` | Secrete. Elle seule authentifie nos appels serveur, et elle seule autorise a encaisser et a retirer. A traiter comme un mot de passe |
| `pk_…` | Publique. Prevue pour les parcours ou le navigateur s'adresse directement a la passerelle. Nous n'en sommes pas la : tout passe par notre API |

`ELGIOPAY_API_KEY` est donc remplace par `ELGIOPAY_SECRET_KEY` et
`ELGIOPAY_PUBLIC_KEY`. L'ancien nom reste lu en dernier recours, pour qu'un
environnement pas encore mis a jour ne tombe pas en panne sans explication.

**Premier piege** : la cle publique est la plus visible des deux et la plus
facile a copier. Placee dans `ELGIOPAY_SECRET_KEY`, elle fait echouer chaque
appel, et le candidat ne voit qu'un « paiement impossible » generique. Le
diagnostic previent maintenant quand la cle configuree ne commence pas par
`sk_`.

**Second piege** : une cle n'authentifie que l'hote de son environnement. Une
cle `…_test_…` est refusee par `api.elgiopay.com`, une cle `…_live_…` par
`sandbox-api.elgiopay.com`. Le diagnostic compare les deux avant le premier
appel et s'arrete net — sans quoi le symptome, « cle refusee », pointe vers
la mauvaise cause.

**Troisieme point** : renouveler une cle depuis le tableau de bord invalide
immediatement la precedente. A faire au moindre soupcon de fuite, mais en
sachant que les encaissements s'arretent jusqu'a la mise a jour du `.env`.

**Etat au 10 octobre au soir** : la cle secrete en place est refusee,
**HTTP 401** sur `GET /api/v1/balance`. Deux causes possibles, et une seule
requete suffit a les departager :

1. la cle a ete mal recopiee — elle avait ete relevee a l'oeil, pas collee ;
2. cette API attend encore la cle publique en jeton Bearer, comme avant le
   passage au couple de cles.

Le diagnostic sonde desormais la cle publique quand la secrete echoue en 401,
et dit laquelle des deux passe. Il affiche aussi le statut HTTP reel : « cle
refusee » (401), « droit manquant » (403), « chemin inconnu » (404) et
« passerelle injoignable » n'appellent pas la meme correction, et les
confondre fait chercher au mauvais endroit.

**A faire en premier** : recopier la cle secrete avec le bouton de copie du
tableau de bord, jamais a la main. Si le refus persiste sur une cle collee
telle quelle, la question est pour Elgiopay, pas pour notre configuration.

### Commission et tresorerie

Observe sur une transaction reelle du bac a sable : **8 000 FCFA encaisses,
160 FCFA de frais, 7 840 FCFA nets — soit 2 %.** Confirme par le solde, qui
progresse de 7 840 XAF a chaque encaissement reussi.

Reste a confirmer aupres d'Elgiopay : le taux est-il identique sur MTN et
Orange, et s'applique-t-il aussi au retrait ?

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
