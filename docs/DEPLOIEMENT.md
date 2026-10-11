# Deploiement de production

Procedure de reference pour `artvibecamer.com`. Elle correspond a
l'architecture effectivement mise en ligne et verifiee le 11 octobre 2026.

## Architecture retenue

| Adresse | Contenu | Execution |
| --- | --- | --- |
| `https://artvibecamer.com` | Site public et back-office Next.js | Cloudflare Workers, via OpenNext |
| `https://api.artvibecamer.com` | API Laravel 13 | Hostinger Business, PHP 8.4 |

Le front n'est ni une application Node geree par Hostinger, ni un export
statique. Les pages dynamiques, le suivi des paiements, les exports et le
back-office ont besoin d'un runtime : ils sont servis par le Worker
Cloudflare. Hostinger ne sert que Laravel et MySQL.

Le deploiement mesure 1,47 Mio compresse, sous la limite de 3 Mio constatee
sur le palier Workers utilise.

## Chemins de reference

Remplacer une seule fois `<user>` par l'identifiant du compte Hostinger. Tous
les exemples de ce document utilisent ensuite les memes chemins :

| Element | Chemin |
| --- | --- |
| Depot Git | `/home/<user>/depot` |
| Backend Laravel | `/home/<user>/depot/backend` |
| Racine publique de l'API | `/home/<user>/depot/backend/public` |
| Racine Hostinger exposee | `/home/<user>/domains/api.artvibecamer.com/public_html` |
| PHP en ligne de commande | `/opt/alt/php84/usr/bin/php` |

Le `php` fourni par le `PATH` Hostinger reste en 8.3. Il ne doit pas servir a
Composer, Artisan ou au planificateur : le verrou Composer exige PHP 8.4.1 ou
plus recent.

## 1. DNS, domaines et TLS

La zone DNS est geree par Cloudflare :

1. rattacher `artvibecamer.com` au Worker comme domaine personnalise ;
2. faire pointer `api.artvibecamer.com` vers Hostinger en mode **DNS only**
   (nuage gris) ;
3. rediriger `www.artvibecamer.com` vers le domaine nu, ou ajouter cette
   origine dans `ADMIN_URL` cote Laravel ;
4. verifier HTTPS sur les deux adresses avant d'activer HSTS.

Le proxy Cloudflare reste desactive devant l'API. Laravel doit recevoir
l'adresse du visiteur pour que les limites de debit par IP restent utiles.

## 2. API Laravel sur Hostinger

Dans hPanel, creer `api.artvibecamer.com` comme site PHP/HTML independant,
activer SSH, selectionner **PHP 8.4** pour le serveur web et creer la base
MySQL.

### Installation initiale

```bash
cd /home/<user>
git clone --branch main --single-branch \
  git@github.com:russelfotie777-source/ArtVibeCamer.git depot
cd /home/<user>/depot/backend

# Forcer Composer a utiliser PHP 8.4, quelle que soit sa ligne de lancement.
COMPOSER_PATH="$(command -v composer)"
/opt/alt/php84/usr/bin/php "$COMPOSER_PATH" install \
  --no-dev --optimize-autoloader --no-scripts --no-plugins

/opt/alt/php84/usr/bin/php artisan package:discover

cp .env.example .env
/opt/alt/php84/usr/bin/php artisan key:generate
```

**`--no-scripts --no-plugins` n'est pas une precaution mais une necessite.**
`proc_open` est desactive sur le PHP de ce plan, et Composer s'en sert pour
executer les scripts : sans ces deux options il s'interrompt sur
« The Process class relies on proc_open ». Les scripts ecartes font le travail
de `package:discover`, d'ou son appel juste apres.

Si l'installation a deja tourne avec les dependances de developpement, le
manifeste cache garde une trace de paquets absents en production et toute
commande `artisan` echoue sur « Class Laravel\Pail\PailServiceProvider not
found ». Dans ce cas, supprimer les caches avant de redecouvrir :

```bash
rm -f bootstrap/cache/packages.php bootstrap/cache/services.php bootstrap/cache/config.php
/opt/alt/php84/usr/bin/php artisan package:discover
```

Le depot reste hors de l'espace servi. La racine web est un lien symbolique
vers le seul dossier qui peut etre public :

```bash
cd /home/<user>/domains/api.artvibecamer.com
mv public_html public_html.origine
ln -s /home/<user>/depot/backend/public public_html
```

Verifier ensuite que `public_html` cible exactement
`/home/<user>/depot/backend/public`. Le fichier `.env`, `storage` et le reste
du depot ne doivent jamais etre accessibles depuis le web.

### Environnement de production

```dotenv
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.artvibecamer.com
FRONTEND_URL=https://artvibecamer.com
# Laisser vide si www redirige vers le domaine nu :
ADMIN_URL=

DB_CONNECTION=mysql
DB_HOST=localhost
DB_DATABASE=...
DB_USERNAME=...
DB_PASSWORD=...

# Laisser vide tant qu'aucun proxy precis n'a ete identifie.
TRUSTED_PROXIES=

PAYMENT_DRIVER=elgiopay
PAYMENT_CURRENCY=XAF
ELGIOPAY_BASE_URL=https://api.elgiopay.com
ELGIOPAY_SECRET_KEY=sk_live_...
ELGIOPAY_PUBLIC_KEY=pk_live_...
ELGIOPAY_AUTH_KEY=publique
ELGIOPAY_WEBHOOK_SECRET=whsec_...
ELGIOPAY_MAX_RPS=4
```

`ELGIOPAY_AUTH_KEY=publique` est le reglage confirme en production le
11 octobre 2026. Sur `GET /api/v1/balance`, la cle `sk_live_...` a renvoye
HTTP 401 et la cle `pk_live_...` HTTP 200 ; le bac a sable presente le meme
comportement. Ce n'est donc pas un contournement reserve aux tests. Ne pas
repasser a `secrete` sans refaire ce controle avec Elgiopay.

`APP_DEBUG=false` est obligatoire : une page d'erreur detaillee peut exposer
les requetes, la configuration et les secrets de paiement.

### Base, stockage et caches

Pour la premiere installation uniquement :

```bash
cd /home/<user>/depot/backend
/opt/alt/php84/usr/bin/php artisan migrate --force
/opt/alt/php84/usr/bin/php artisan db:seed --force
/opt/alt/php84/usr/bin/php artisan storage:link
/opt/alt/php84/usr/bin/php artisan config:cache
/opt/alt/php84/usr/bin/php artisan route:cache
/opt/alt/php84/usr/bin/php artisan view:cache
```

Ne pas inclure `db:seed` dans les redeploiements : certains seeders utilisent
`updateOrCreate` et reecriraient des tarifs ou reglages devenus administrables.

En production, le seeder affiche une seule fois un mot de passe aleatoire pour
`admin@artvibecamer.cm`. Le noter, creer ensuite les comptes nominatifs avec
`/opt/alt/php84/usr/bin/php artisan user:create`, puis desactiver le compte
d'amorcage. Le mot de passe `password` ne concerne que le developpement.

Apres toute modification du `.env`, reconstruire les caches. Un
`config:clear` utilise pour diagnostiquer doit toujours etre suivi de
`config:cache`.

## 3. Front Next.js sur Cloudflare Workers

Le front se construit depuis une machine de deploiement ou la CI, avec les
identifiants Cloudflare disponibles dans l'environnement :

```bash
cd frontend
npm ci

export NEXT_PUBLIC_API_URL=https://api.artvibecamer.com/api/v1
export NEXT_PUBLIC_SITE_URL=https://artvibecamer.com
export NEXT_PUBLIC_SITE_NAME=ArtVibeCamer
export NODE_ENV=production

npm run cf:build
npx wrangler deploy
```

`NEXT_PUBLIC_*` est injecte au build. Ajouter ces valeurs seulement dans les
variables du Worker ne modifie pas un bundle deja construit.

`NEXT_PUBLIC_API_URL` sert aussi a autoriser le domaine des photos dans
`next/image`; une mauvaise valeur peut laisser le build aboutir tout en
cassant les fiches candidats en production.

Next.js reste fige a `16.3.8`. La version 16.4.0, avec
`@opennextjs/cloudflare` 1.20.10, provoque des erreurs 1101 sur les routes
dynamiques du Worker. Toute montee de version doit etre validee sur un Worker,
pas seulement avec `next build` ou `next start`.

## 4. Planificateur Hostinger

Le plan ne fournit pas `crontab` en SSH. Dans **hPanel > Avance > Taches
Cron**, choisir une execution toutes les minutes (`* * * * *`) et saisir cette
commande unique :

```text
/opt/alt/php84/usr/bin/php /home/<user>/depot/backend/artisan schedule:run
```

Cette entree pilote les trois taches declarees par Laravel :

- `payments:reconcile` toutes les cinq minutes ;
- controle quotidien des compteurs de votes a 03:30 ;
- purge quotidienne des jetons Sanctum expires.

Verifier la configuration avec :

```bash
/opt/alt/php84/usr/bin/php /home/<user>/depot/backend/artisan schedule:list
/opt/alt/php84/usr/bin/php /home/<user>/depot/backend/artisan schedule:run
```

La reconciliation emploie `runInBackground()`. Elle est active sur le serveur
de production ; apres un changement d'offre Hostinger, verifier que
`proc_open` reste autorise. Sans le cron, un paiement dont le webhook se perd
reste en attente jusqu'a une verification manuelle.

## 5. Elgiopay

Dans le tableau de bord Elgiopay de production, declarer exactement :

```text
https://api.artvibecamer.com/api/v1/webhooks/payments/elgiopay
```

Le chemin d'exemple `/webhooks/elgiopay` affiche par le fournisseur n'est pas
celui de l'application. Le secret `whsec_...` n'est affiche qu'a la creation
ou a la rotation : le sauvegarder immediatement dans le `.env` Hostinger.

Le 11 octobre 2026, deux paiements reels de 100 FCFA ont confirme le parcours
complet sur MTN Mobile Money et Orange Money : evenement
`payment.completed`, signature du webhook valide et frais de 2 FCFA dans les
deux cas. La commission d'encaissement mesuree est donc de 2 % sur les deux
reseaux ; le cout d'un retrait reste a verifier.

Diagnostic depuis le serveur :

```bash
cd /home/<user>/depot/backend
/opt/alt/php84/usr/bin/php artisan elgiopay:diagnostic --scenario=699000000
```

## 6. Redeploiement

### API

```bash
cd /home/<user>/depot
git pull --ff-only origin main
cd backend

COMPOSER_PATH="$(command -v composer)"
/opt/alt/php84/usr/bin/php "$COMPOSER_PATH" install \
  --no-dev --optimize-autoloader --no-interaction
/opt/alt/php84/usr/bin/php artisan migrate --force
/opt/alt/php84/usr/bin/php artisan config:cache
/opt/alt/php84/usr/bin/php artisan route:cache
/opt/alt/php84/usr/bin/php artisan view:cache
```

Ne pas relancer `db:seed`. Le lien `storage` et le lien `public_html` restent
en place.

### Front

Reprendre les commandes de la section Cloudflare avec un checkout de `main`
a jour. Verifier les routes dynamiques apres chaque changement de Next.js ou
d'OpenNext.

## 7. Verification apres deploiement

Executer dans cet ordre :

- [ ] `https://api.artvibecamer.com/up` renvoie HTTP 200 ;
- [ ] `https://api.artvibecamer.com/api/v1/categories` renvoie du JSON ;
- [ ] la page d'accueil et les photos s'affichent ;
- [ ] la connexion au back-office fonctionne avec un compte nominatif ;
- [ ] les exports CSV Candidats et Paiements ne renvoient pas 401 ;
- [ ] une inscription ou un vote de faible montant aboutit jusqu'au webhook ;
- [ ] `payment_webhooks` contient `signature_valid = 1` et un
      `processed_at` renseigne ;
- [ ] le cron apparait actif dans hPanel et `schedule:list` est coherent ;
- [ ] les sauvegardes couvrent MySQL **et** `storage/app/public` ;
- [ ] `api.artvibecamer.com` reste en nuage gris dans Cloudflare.

Ne jamais mettre `TRUSTED_PROXIES=*`. Une valeur aussi large permettrait a un
client de choisir son adresse apparente et de contourner les limites de debit.
