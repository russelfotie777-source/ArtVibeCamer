# Journal de bord

Etat d'avancement du projet, point d'arret et suite a donner.
**A lire avant toute reprise du code, et a mettre a jour a chaque fin de
session.** C'est ce fichier qui permet a quelqu'un d'autre de reprendre sans
avoir a reconstituer le contexte.

- **Echeance MVP** : 10 octobre 2026
- **Derniere mise a jour** : 11 octobre 2026

---

## Ou on en est

> **Ouvert au public le 11 octobre.** Premier encaissement reel abouti sur les
> deux operateurs. Procedure et pieges dans [DEPLOIEMENT.md](DEPLOIEMENT.md).
>
> | Couche | Adresse | Hebergeur |
> | --- | --- | --- |
> | Site et back-office | `https://artvibecamer.com` | Cloudflare Workers |
> | API | `https://api.artvibecamer.com` | Hostinger, PHP 8.4 |
>
> DNS gere par Cloudflare, enregistrement `api` en nuage gris pour que Laravel
> voie l'adresse reelle du visiteur. HTTPS, HSTS et en-tetes de securite poses
> sur les deux tiers. Cron de reconciliation actif.
>
> **Encaissement valide en production**, sur de vrais debits de 100 FCFA :
>
> | Operateur | Resultat | Frais |
> | --- | --- | --- |
> | MTN Mobile Money | `payment.completed` | 2 FCFA sur 100 |
> | Orange Money | `payment.completed` | 2 FCFA sur 100 |
>
> Notifications recues sur le webhook de production, **signature verifiee** dans
> les deux cas. La commission est donc bien de **2 %, identique sur les deux
> reseaux** — la question etait ouverte depuis le 7 octobre.

## Etat fonctionnel au 11 octobre

| Module | Backend | Interface |
| --- | --- | --- |
| Inscription individuelle et en groupe | Fait | Fait |
| Paiement, suivi et relance | Fait | Fait |
| Liste et fiche publiques des candidats | Fait | Fait |
| Achat de voix | Fait | Fait |
| Resultats publics | Fait | A faire |
| Tableau de bord, candidats, paiements et exports | Fait | Fait |
| Billetterie et QR codes | Fait | A faire |
| Controle des billets a l'entree | Fait | A faire |
| Categories, tarifs, reglages et moderation des votes | Fait | A faire dans le back-office |

Le parcours public en production couvre donc l'inscription et les fiches des
candidats ; l'interface d'achat de voix est livree et son ouverture reste
pilotee par les reglages de l'evenement. La billetterie, le scan et les ecrans
de configuration restent les prochains chantiers d'interface ; leurs services
et routes API existent deja.

## Ce qui est fait, en detail

### Base de donnees

19 migrations, verifiees sur MariaDB 10.4. Schema documente table par table
dans [DATABASE.md](DATABASE.md).

Seeders : 4 categories de concours (Danse, Chant, Comedie, Miss & Master),
3 categories de billets (Standard, VIP, VVIP), 19 reglages d'evenement et
1 compte super administrateur.

### API

Les routes sont exposees sous `/api/v1`; leur contrat est dans
[API.md](API.md).

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
```

Repere historique du 10 octobre : **64 tests, 263 assertions**. La suite a
ensuite ete completee avec les cas observes en production, notamment le motif
d'echec renvoye au payeur.

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

### Verifie manuellement avant la mise en ligne

Le parcours historique suivant a ete deroule contre le serveur local avant le
passage aux quatre categories et aux tarifs actuels : inscription Musique
(15 000 FCFA) → numero `AVC-MUS-001` attribue → validation back-office →
achat de 25 voix (2 500 FCFA) → commande de 3 billets (35 000 FCFA) →
3 billets emis avec QR → scan accepte puis refuse au second passage →
tableau de bord affichant 50 000 FCFA de recettes.

---

## Point d'arret actuel

### Pages disponibles

| Page | Chemin |
| --- | --- |
| Accueil, disciplines et tarifs | `/` |
| Formulaire d'inscription | `/inscription` |
| Suivi du paiement, relance en cas d'echec | `/paiement/[reference]` |
| Liste publique des candidats | `/candidats` |
| Fiche publique d'un candidat | `/candidats/[slug]` |
| Achat de voix | `/candidats/[slug]/voter` |
| Connexion de l'equipe | `/connexion` |
| Tableau de bord | `/admin` |
| Liste des candidats, filtres, recherche | `/admin/candidats` |
| Fiche candidat, validation et rejet | `/admin/candidats/[id]` |
| Suivi des paiements, verification | `/admin/paiements` |

### Suite a donner

1. Construire la billetterie publique et la page de recuperation des billets.
2. Construire l'ecran mobile de scan pour les agents d'entree.
3. Ajouter la page publique des resultats avec les cas `403` et
   `votes_count: null` prevus par l'API.
4. Completer le back-office : categories et tarifs, types de billets,
   annulation des votes suspects et reglages de l'evenement.
5. Executer `php artisan counters:recalculate --dry-run` avant toute
   proclamation de resultats.

### Ameliorations utiles apres le MVP

- Envoi du billet par email et WhatsApp (`ticket_orders.delivered_at` et
  `delivery_channel` sont deja prevus en base, rien n'est branche).
- Generation d'un PDF de billet.
- Notification du candidat a la validation de son dossier.
- Compte candidat permettant de suivre ses propres voix.
- Pagination par curseur sur `/admin/votes` si le volume devient important.

## Jalons historiques

- **7–8 octobre** : les scenarios d'echec et de delai du bac a sable Elgiopay
  sont corriges apres signalement ; le format divergent de `GET /balance`
  reste pris en charge par le driver.
- **10 octobre** : passage au couple `sk_...` / `pk_...`, validation locale du
  secret `whsec_...` et de trois cas de signature. L'URL de webhook n'etait
  alors pas encore declaree, faute de domaine stable.
- **11 octobre** : premier deploiement, branchement du domaine definitif,
  activation du cron et du webhook, puis ouverture au public. Les paiements
  reels MTN et Orange confirment la signature et la commission de 2 %.

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

### Next.js est fige a 16.3.8, et ce n'est pas un oubli

Le front tourne sur Cloudflare Workers via l'adaptateur OpenNext. **Next.js
16.4 le casse** : cette version deplace les preview props dans
`.next/server/preview-props.json`, un fichier que le chargeur de manifestes
de l'adaptateur ne reconnait pas. Toutes les routes dynamiques repondent
alors 500, avec l'erreur Cloudflare 1101 :

```
Error: Unexpected loadManifest(/.next/server/preview-props.json) call!
```

Constate en production le 11 octobre, sur next 16.4.0 et
@opennextjs/cloudflare 1.20.10. Le correctif est ouvert chez eux (PR #1356 et
#1428) mais pas publie.

La version est donc **figee sans accent circonflexe** dans `package.json` :
`"next": "16.3.8"`. Un `^` suffirait a ramener 16.4 au prochain `npm install`
et a remettre le site hors ligne.

**Le piege** : rien ne se voit en local. `next build` aboutit, `next start`
sert les pages normalement. L'erreur n'existe que dans le runtime Workers.
Toute montee de version de Next doit donc etre verifiee par un deploiement
reel, pas par un build.

A rouvrir des qu'une version de l'adaptateur integre ces correctifs.

### `env()` hors des fichiers de configuration

`TRUSTED_PROXIES` etait lu par `env()` dans `bootstrap/app.php`. Les
middlewares y sont configures **avant le chargement de la configuration**, et
des que `config:cache` est actif — donc en production — Laravel ne lit plus
le fichier `.env` du tout. Verifie : sous `config:cache`,
`env('TRUSTED_PROXIES')` renvoie `NULL` la ou le `.env` contient bien une
valeur.

Le garde-fou disparaissait donc silencieusement, precisement la ou il sert :
Laravel aurait vu l'adresse du serveur Next pour tous les visiteurs, et les
plafonds par IP auraient bloque le public des les premieres inscriptions.
Rien ne l'aurait signale, ni au deploiement ni dans les journaux.

Le reglage vit maintenant dans `config/trustedproxy.php`, que le middleware
`TrustProxies` lit au moment de la requete — c'est le chemin prevu par le
framework.

**Regle generale** : `env()` ne s'appelle que depuis `config/`. Partout
ailleurs, passer par `config()`. Un `grep -rn "env(" app/ routes/ bootstrap/`
doit rester vide.

### Limites de debit et rendu serveur

Les pages publiques sont rendues cote serveur, mais les ecritures sensibles
(inscription, vote, relance et suivi du paiement) partent directement du
navigateur vers l'API. L'enregistrement DNS `api` reste en nuage gris :
Laravel voit ainsi l'adresse du visiteur sans faire confiance a un proxy.

`TRUSTED_PROXIES` reste vide tant qu'aucun proxy precis n'est insere devant
l'API. Si l'architecture change, n'y inscrire que ses adresses verifiees et
jamais `*` : un client pourrait sinon choisir son adresse apparente et
contourner les limites de debit.

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

**Contre le bac a sable Elgiopay**, avec `PAYMENT_DRIVER=elgiopay`, le couple
`sk_test_…` / `pk_test_…`,
`ELGIOPAY_BASE_URL=https://sandbox-api.elgiopay.com` et
`ELGIOPAY_AUTH_KEY=publique`. Le resultat depend du numero du payeur :

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

### Rattrapage en l'absence de webhook

Avant le branchement du domaine, aucune URL stable ne pouvait etre declaree
chez Elgiopay. Trois chemins permettaient tout de meme de confirmer un
paiement :

| Chemin | Quand | Delai de confirmation |
| --- | --- | --- |
| Ecran d'attente du candidat | Tant que l'onglet reste ouvert | 25 a 40 secondes |
| `payments:reconcile` | Toutes les 5 minutes, par le planificateur | 5 minutes au pire |
| Bouton « Verifier » du back-office | A la demande | Immediat |

`payments:reconcile` redemande d'abord l'etat reel a la passerelle et
n'expire que ce qu'elle ne reconnait toujours pas comme paye, dix minutes
apres le delai. Le cron doit donc tourner meme lorsque le webhook fonctionne :
il reste le filet de securite d'une notification perdue.

Depuis le 11 octobre, le webhook de production est actif a l'adresse exacte
`https://api.artvibecamer.com/api/v1/webhooks/payments/elgiopay`. Les
notifications signées constituent le chemin normal ; les trois mecanismes
ci-dessus restent des solutions de rattrapage. En local, lancer
`php artisan schedule:work` ou `php artisan payments:reconcile` a la main.

### Deux cles Elgiopay, une seule authentifie

Depuis le 10 octobre, le tableau de bord delivre un couple de cles par
application :

| Cle | Role annonce dans le tableau de bord |
| --- | --- |
| `sk_…` | Cle serveur secrete, a traiter comme un mot de passe |
| `pk_…` | Cle publique destinee aux parcours cote navigateur |

Le code conserve les deux dans `ELGIOPAY_SECRET_KEY` et
`ELGIOPAY_PUBLIC_KEY`; `ELGIOPAY_AUTH_KEY` choisit celle envoyee en jeton
Bearer. Les cles restent liees a leur environnement : une cle `test` est
refusee par l'hote live et reciproquement.

Les mesures ont contredit le role annonce par le tableau de bord :

| Date et environnement | Cle secrete | Cle publique |
| --- | --- | --- |
| 10 octobre, bac a sable | HTTP 401 | HTTP 200 |
| 11 octobre, production, application `ProductFinal` (`app_000016`) | HTTP 401 | HTTP 200 |

La cle live avait ete recopiee avec le bouton du tableau de bord et controlee
sans espace ni retour a la ligne. `ELGIOPAY_AUTH_KEY=publique` est donc le
reglage de production confirme, pas une hypothese ni un contournement limite
au bac a sable. L'ecart reste a signaler a Elgiopay, puisque leur interface
presente toujours la cle secrete comme credential serveur.

Deux tests tiennent explicitement les modes `secrete` et `publique`, afin
que la suite ne depende jamais du `.env` de la machine. Renouveler une cle
invalide immediatement la precedente : mettre le serveur a jour sans delai
apres une rotation.

### Commission et tresorerie

Observe sur une transaction reelle du bac a sable : **8 000 FCFA encaisses,
160 FCFA de frais, 7 840 FCFA nets — soit 2 %.** Confirme par le solde, qui
progresse de 7 840 XAF a chaque encaissement reussi.

**Confirme le 11 octobre en production** : 2 FCFA preleves sur 100, a
l'identique sur MTN et sur Orange. Reste a verifier si le taux s'applique
aussi au retrait.

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

### Le motif d'echec, tel qu'Elgiopay le formule reellement

La traduction des motifs reconnait la cause sur des mots-cles. Le premier jeu
s'appuyait sur « not enough » — tournure plausible, mais pas celle d'Elgiopay,
qui ecrit :

> The customer does **not have enough** funds to complete this payment.

L'anglais intercale « have », aucun mot-cle ne declenchait, et le payeur
recevait le message generique la ou il fallait lui dire de recharger son
compte. Les mots-cles couvrent desormais `enough fund`, `enough money` et
`enough balance`.

**A retenir** : caler ces listes sur une chaine relevee en production, jamais
sur une formulation supposee. Le test porte sur la phrase exacte renvoyee le
11 octobre.

### Le recu de paiement

Un paiement abouti donne un recu en PDF, telechargeable depuis l'ecran de
suivi : `GET /api/v1/payments/{reference}/recu`.

Trois choix qui meritent d'etre connus avant d'y toucher :

| Choix | Raison |
| --- | --- |
| Le document dit ne pas valoir facture | L'evenement n'etablit pas de TVA ; delivrer une « facture » exposerait l'organisation |
| Un paiement non abouti renvoie 404 | Un recu est une preuve d'encaissement : en delivrer un sur un paiement echoue fournirait une preuve a qui n'a rien paye |
| Sous-ensemble de police active | 879 Ko sans, 24 Ko avec. Les payeurs telechargent en data mobile |

L'acces se fait sans authentification, comme l'ecran de suivi : c'est la
reference, aleatoire et connue du seul payeur, qui autorise la lecture.

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
