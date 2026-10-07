# Architecture

Ce document explique les choix structurants et, surtout, **pourquoi** ils ont
ete faits. Si un choix doit etre remis en cause, c'est ici qu'on trouve le
raisonnement d'origine.

---

## 1. Deux applications separees

Laravel expose une API REST, Next.js la consomme. Aucune vue Blade, aucun
rendu serveur cote Laravel.

**Pourquoi** : deux personnes peuvent travailler en parallele sans se
marcher dessus, le contrat d'API etant la seule frontiere. C'est aussi ce qui
permet de developper le front avec des donnees reelles avant que toutes les
pages soient pretes.

**Consequence** : toute erreur doit sortir en JSON. C'est garanti par
`shouldRenderJsonWhen()` dans `bootstrap/app.php`. Une page HTML d'erreur
Laravel dans une reponse d'API serait un bug.

---

## 2. L'argent en nombres entiers

Le franc CFA n'a pas de sous-unite. Tous les montants sont des entiers de
FCFA, en base comme dans le code.

**Pourquoi** : aucun `float` ne touche a un montant. Un `DECIMAL` serait
correct mais inutilement lourd pour une devise sans centimes, et exposerait a
des arrondis dans les totaux.

**Regle** : si un montant apparait un jour en `float` ou en `string` dans une
signature de methode, c'est une regression.

---

## 3. Une seule table pour tous les encaissements

`transactions` journalise les trois flux — inscriptions, votes, billets — avec
une relation polymorphe `payable` vers `Candidate`, `Vote` ou `TicketOrder`.

**Pourquoi** :

- les recettes consolidees du tableau de bord se lisent avec un seul
  `GROUP BY type` ;
- la reconciliation avec les releves de l'operateur Mobile Money se fait au
  meme endroit, quel que soit le flux ;
- ajouter un quatrieme flux (dons, stands, partenariats) ne demande pas une
  nouvelle table de paiement.

**Alternative ecartee** : une table de paiement par module. Cela aurait
multiplie par trois le code de gestion des webhooks et de l'idempotence, pour
aucun gain.

---

## 4. Le paiement est la seule source des contreparties

Rien n'est delivre avant la confirmation d'un encaissement :

| Flux | Avant paiement | Apres paiement confirme |
| --- | --- | --- |
| Inscription | Dossier en `awaiting_payment`, sans numero | Numero attribue, dossier en `pending_review` |
| Votes | Lot en `pending`, zero voix creditee | Lot `confirmed`, voix creditees |
| Billets | Commande `pending`, jauge reservee | Billets emis avec QR, jauge vendue |

**Consequence directe** : un billet present en base est, par construction, un
billet paye. Une voix comptee est, par construction, une voix payee. Il n'y a
pas d'etat intermediaire ou une contrepartie existerait sans son paiement.

Le code qui applique cela est concentre dans
`app/Services/Payments/PaymentProcessor.php` et les trois classes de
`app/Services/Payments/Fulfilment/`. **C'est le coeur du systeme : toute
modification y merite une relecture attentive.**

---

## 5. Trois invariants garantis par PaymentProcessor

`PaymentProcessor::applyStatus()` est le seul chemin par lequel une
transaction change d'etat. Il garantit :

1. **Pas de rejeu.** Une transaction dans un etat final n'en sort plus. Une
   notification arrivee en retard ne peut pas re-crediter des voix.
2. **Atomicite.** Le changement d'etat et la delivrance de la contrepartie
   sont dans la meme transaction SQL. Pas de billet emis sans paiement
   enregistre, pas de paiement enregistre sans billet emis.
3. **Serialisation.** La ligne est verrouillee en `lockForUpdate()` pendant le
   traitement, ce qui serialise un webhook et une verification manuelle
   simultanes.

Chaque classe de fulfilment est de plus idempotente par elle-meme : elle
verifie l'etat courant avant d'agir (`candidate_number !== null`,
`status === Confirmed`, `status === Paid`).

---

## 6. Les passerelles de paiement derriere une interface

`PaymentGateway` definit le contrat ; deux implementations existent :

| Driver | Usage |
| --- | --- |
| `fake` | Developpement hors ligne. Aucun appel reseau, aucun debit. Encaisse immediatement, sauf numero finissant par `0` pour exercer le parcours d'echec. **Refuse en production par `PaymentManager`.** |
| `elgiopay` | **La passerelle reelle.** MTN Mobile Money et Orange Money. |

**Pourquoi l'interface** : les credentials n'etaient pas disponibles au
demarrage du projet. Sans elle, tout le developpement des parcours payants
aurait ete bloque. Elle sert toujours : ajouter un second operateur ne touche
ni les controleurs ni les services metier.

> Deux drivers speculatifs (Campay, CinetPay) ont existe le temps d'attendre
> le choix de l'operateur. Ils ont ete retires a l'arrivee d'Elgiopay : du
> code jamais confronte a un compte reel induit en erreur plus qu'il n'aide.

### Elgiopay

Parcours asynchrone : on declenche la collecte, l'operateur envoie une demande
de code sur le telephone du payeur, et Elgiopay notifie le resultat. La
transaction reste `processing` entre les deux.

| Point | Detail |
| --- | --- |
| Hotes | `sandbox-api.elgiopay.com` en test, `api.elgiopay.com` en production. L'API refuse tout autre sous-domaine |
| Cles | `pk_test_…` / `pk_live_…`, en jeton Bearer |
| Lancement | `POST /api/v1/payments` avec `payment_method` deduit du prefixe du numero |
| Lecture | `GET /api/v1/payments/{id}` — Elgiopay interroge lui-meme l'operateur quand la transaction est en cours |
| Notification | Configuree **dans leur tableau de bord**, pas par requete : `https://<domaine>/api/v1/webhooks/payments/elgiopay` |

### Charge imposee a la passerelle

Une passerelle de paiement est un service partage : la saturer degrade le
service de ses autres clients et finit par nous faire bloquer — ce qui, un
jour d'ouverture des inscriptions, revient a fermer la billetterie.

Trois garde-fous, du plus important au moins :

**1. Une verification par transaction et par intervalle.** L'ecran d'attente
du candidat interroge notre API toutes les quelques secondes. Chacune de ces
interrogations repercutait l'appel sur la passerelle : cent candidats devant
leur telephone produisaient des dizaines d'appels par seconde chez elle, pour
une information qui ne change qu'une fois.

`PaymentProcessor::refreshIfStale()` n'appelle la passerelle qu'une fois par
`verification_interval_seconds` et par transaction. `Cache::add` etant
atomique, plusieurs interrogations simultanees ne produisent qu'un seul
appel. **La notification reste le mecanisme principal ; cette verification
n'est qu'un filet quand elle se perd.**

**2. Une cadence degressive cote candidat.** Les premieres secondes sont
celles ou le payeur saisit son code : on interroge souvent pour que la
confirmation paraisse instantanee. Passe ce moment, la probabilite qu'il
valide a cet instant precis s'effondre, et l'intervalle s'allonge — 4 s, puis
8 s, puis 15 s.

**3. Un plafond global d'appels sortants.** `CadenceSortante` compte les
appels dans le cache, donc tous processus confondus : un compteur en memoire
ne verrait que son propre worker et laisserait passer autant de fois la
limite qu'il y a de workers. Au-dela du plafond on attend la seconde
suivante plutot que d'echouer — un encaissement differe d'une seconde reste
un encaissement, un encaissement abandonne est un candidat perdu.

On ne rejoue par ailleurs que ce qui a une chance d'aboutir : coupure reseau,
panne passagere, ou plafond atteint chez eux. Rejouer une cle refusee ou une
requete malformee triple la charge sans jamais changer le resultat.

Ces regles sont couvertes par `tests/Feature/CadenceTest.php`.

### Authenticite des notifications

Trois verifications, dans cet ordre, avant de toucher a quoi que ce soit :

1. **Signature.** HMAC-SHA256 de `"{t}.{corps brut}"` avec le secret
   `whsec_…`. Le corps est lu **tel qu'il est arrive** : le reserialiser, ne
   serait-ce qu'en changeant un espace, invalide la signature.
2. **Fenetre temporelle.** Au-dela de 5 minutes d'ecart, la notification est
   refusee. Sans cela, une notification authentique capturee puis renvoyee
   plus tard pourrait recrediter un paiement.
3. **Comparaison a temps constant** (`hash_equals`). Une comparaison naive
   laisserait deviner la signature octet par octet.

La deduplication se fait ensuite sur l'identifiant d'evenement, Elgiopay
rejouant jusqu'a huit fois sur environ 45 heures tant qu'il n'obtient pas de
2xx.

Tous les evenements ne changent pas l'etat d'un paiement : les versements
(`payout.*`) et la mise a disposition d'un code prepaye
(`payment.pin_available`) sont acquittes sans effet metier, pour qu'ils ne
soient pas rejoues indefiniment.

Ces regles sont couvertes par `tests/Feature/ElgiopayTest.php` : signature
invalide, horodatage perime, rejeu du meme evenement, echec notifie.

## 7. Compteurs denormalises, et comment on les tient

`candidates.votes_count`, `categories.votes_count` et
`categories.candidates_count` sont tenus a jour par incrementation.

**Pourquoi** : le classement public est la page la plus consultee d'un
concours de ce type. Agreger `votes` a chaque affichage, avec plusieurs
dizaines de milliers de lignes attendues, serait le premier goulot
d'etranglement.

**Le revers** : une derive est possible (incident, intervention manuelle en
base). Deux garde-fous :

- un seul endroit du code incremente `votes_count` : `VoteFulfilment`. Toute
  autre voie serait une faille ;
- `php artisan counters:recalculate` recalcule les compteurs depuis `votes`,
  qui fait foi. A passer en `--dry-run` **avant la proclamation des
  resultats**.

---

## 8. Anti-fraude sur les votes

Le vote est payant : c'est la premiere barriere, et la plus solide. Gonfler un
score coute de l'argent reel. Par-dessus :

- **le prix vient du serveur.** Le client n'envoie qu'une quantite. Le prix
  unitaire est lu dans la categorie. Un montant envoye par le navigateur est
  ignore (test automatise : `VotingTest::test_le_montant_est_calcule_par_le_serveur`) ;
- **aucune voix avant paiement.** Un paiement abandonne ne laisse rien ;
- **tracabilite.** IP, user-agent et empreinte de navigateur sont conserves
  sur chaque lot ;
- **annulation a posteriori.** `/admin/votes/suspicious` liste les
  concentrations anormales par IP et par empreinte ; l'organisation decide,
  rien n'est bloque automatiquement. L'annulation retire les voix du compteur
  et conserve la justification.

**Choix assume** : aucun blocage automatique sur l'IP. Au Cameroun, une
connexion partagee ou un operateur mobile peut faire sortir des centaines de
votants legitimes derriere la meme adresse. Bloquer automatiquement
reviendrait a refuser de l'argent a des votants reels.

---

## 9. Billets et controle a l'entree

Chaque billet porte un `qr_token` de 256 bits aleatoires, ni sequentiel ni
derive d'une donnee metier, et un `code` court dictable par telephone si le QR
est illisible.

Le passage de `valid` a `used` se fait par un **UPDATE conditionne sur l'etat
courant** :

```php
Ticket::whereKey($id)->where('status', 'valid')->update([...]) === 1
```

**Pourquoi** : si deux agents scannent le meme billet au meme instant, un seul
`UPDATE` affecte une ligne, donc une seule entree est autorisee. Un `SELECT`
suivi d'un `UPDATE` laisserait passer les deux.

Chaque presentation est journalisee dans `scan_logs`, refus compris : utile
pour le comptage des entrees et pour les litiges a la porte.

---

## 10. Reservation de jauge

Les places sont reservees (`quantity_reserved`) des la creation de la commande
et liberees si le paiement n'aboutit pas.

**Pourquoi** : sans reservation, deux acheteurs payant simultanement les
dernieres places seraient tous les deux encaisses, et il faudrait rembourser
l'un des deux le soir de l'evenement. Les lignes `ticket_types` sont
verrouillees par identifiant croissant pour eviter les interblocages entre
deux commandes portant sur les memes categories.

La liberation des commandes abandonnees est faite par `payments:reconcile`,
qui **verifie d'abord aupres de la passerelle** avant d'expirer : l'inverse
expirerait des paiements reellement encaisses.

---

## 11. Roles

Quatre roles plats, portes par l'enum `UserRole` :

| Role | Perimetre |
| --- | --- |
| `super_admin` | Tout, y compris les comptes |
| `admin` | Candidats, categories, tarifs, billetterie, exports |
| `moderator` | Lecture et validation des inscriptions |
| `scanner` | Uniquement le scan a l'entree |

Les capacites sont definies dans l'enum lui-meme (`canManage()`,
`canModerate()`, `canScan()`...) et appliquees par le middleware
`can.do:<capacite>`. Un seul endroit a lire pour savoir qui peut quoi.

**Pas de page d'inscription.** Les comptes sont crees par
`php artisan user:create`. Un back-office qui donne acces aux recettes et aux
donnees personnelles n'a aucune raison d'exposer un formulaire de creation de
compte sur internet.

---

## 12. Donnees personnelles

Les candidats confient nom civil, telephone, email et date de naissance. Rien
de tout cela ne sort vers le public : `CandidateResource` ne renvoie ces
champs que si la requete est authentifiee avec un role du back-office.
Publiquement, un candidat est identifie par son nom de scene et son numero.

Test automatise :
`AccessControlTest::test_les_donnees_personnelles_ne_sortent_pas_vers_le_public`.

---

## 13. Reglages modifiables sans redeploiement

La table `settings` porte les interrupteurs du jour J : ouverture des
inscriptions, des votes, de la billetterie, publication des resultats,
affichage ou non du nombre de voix.

**Pourquoi** : le soir de l'evenement, fermer les votes doit prendre dix
secondes depuis le back-office, pas un deploiement.

Les reglages sont caches sous forme de **tableau associatif** et non d'objet
`Collection`. Un objet serialise porte des octets NUL pour marquer ses
proprietes protegees, et ces octets ne survivent pas a un aller-retour dans la
colonne texte du cache base de donnees : la valeur relue devient un
`__PHP_Incomplete_Class`. Le probleme a reellement ete rencontre ; ne pas
revenir a un objet.

---

## 14. Garde-fous Eloquent actifs hors production

```php
Model::preventLazyLoading(! $this->app->isProduction());
Model::preventSilentlyDiscardingAttributes(! $this->app->isProduction());
```

Une relation oubliee dans un `eager load` devient une erreur en developpement
plutot qu'une requete N+1 silencieuse en production. Un attribut absent de
`$fillable` leve une exception au lieu d'etre ignore sans bruit — ce qui, sur
un compteur de votes ou un montant, donnerait une ecriture partielle
indetectable.

Corollaire : les champs qui ne doivent **jamais** etre ecrits par
mass assignment (`candidate_number`, `votes_count`) sont volontairement hors
`$fillable`. Les tests qui ont besoin de les poser passent par `forceFill`.

---

## 15. Identite visuelle et fichiers de marque

Les couleurs viennent du logotype de l'evenement, pas d'un choix arbitraire :
le vert foret profond de la typographie sert de fond, l'or de l'etoile sert
d'accent. Le site appartient ainsi visuellement a la marque.

**Choix assume** : on ne reprend pas les bandes vert-rouge-jaune du drapeau.
Elles sont deja dans le logo, ou elles ont leur place ; repetees sur toute la
page, elles entreraient en concurrence avec lui et donneraient une plateforme
institutionnelle plutot qu'un evenement culturel. Le fond reste sobre et
laisse les logos, puis les photos des candidats, porter la couleur.

Les jetons sont definis dans `frontend/src/app/globals.css`, sous `@theme`.
Deux terrains, un seul jeu de jetons : fond vert pour le site public,
fond papier pour le back-office.

### Fichiers de marque

`frontend/public/marque/` contient des PNG detoures a partir des originaux
fournis par l'organisation :

| Fichier | Usage |
| --- | --- |
| `evenement-marque.png` | Illustration seule. En-tete, accueil, favicon |
| `evenement-texte.png` | Lettrage d'origine, vert sombre. Fonds clairs |
| `evenement-texte-clair.png` | Meme lettrage recolorise. **Fonds sombres** |
| `evenement-complet.png` | Verrou complet d'origine |
| `organisateur.png` | SAM BIAI |
| `sponsor-zamara.png` | Zamara, premier sponsor |

Le lettrage d'origine est vert sombre, donc illisible sur le fond vert sombre
du site : d'ou la variante claire, derivee en conservant exactement la forme
des lettres. Elle est servie par le composant `LogoEvenement` selon la
variante demandee.

### Logos partenaires

Les logos de l'organisateur et des sponsors sont poses sur des **tuiles
blanches**, et non directement sur le vert. Celui de l'organisateur comporte
du lettrage noir qui y disparaitrait. Regle generale : un partenaire se montre
dans ses couleurs d'origine, jamais retouche pour s'adapter au fond.

Pour ajouter un sponsor, deposer son fichier dans `public/marque/` et
l'ajouter a `BandePartenaires` dans `frontend/src/components/Marque.tsx`.
