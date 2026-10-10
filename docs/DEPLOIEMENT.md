# Deploiement — Hostinger Business

Procedure de mise en ligne d'ArtVibeCamer sur un plan Hostinger Business,
domaine `artvibecamer.com`.

Ce document decrit ce qui a ete decide et ce qui reste a verifier sur le
serveur. Les points marques **A VERIFIER** n'ont pas pu l'etre depuis le poste
de developpement : ils dependent de l'hebergeur.

---

## Repartition retenue

Le projet est en deux morceaux qui n'ont pas les memes besoins :

| Sous-domaine | Contenu | Execution |
| --- | --- | --- |
| `artvibecamer.com` | Site public et back-office (Next.js 16) | Node.js, process permanent |
| `api.artvibecamer.com` | API Laravel 13 | PHP 8.3, racine sur `backend/public` |

**Le front ne peut pas etre servi en statique.** `next build` produit douze
routes dont dix sont rendues a la demande : le formulaire d'inscription, le
suivi de paiement, les fiches candidats et tout le back-office lisent l'API au
moment de la requete. Il faut un process Node qui tourne, pas un dossier de
fichiers. C'est la raison du plan Business plutot que Premium.

Consequence de la separation : le navigateur ecrit directement sur l'API, donc
`FRONTEND_URL` doit etre renseigne cote Laravel pour que CORS laisse passer.

---

## 1. Avant de toucher au serveur

Dans hPanel :

- [ ] Rattacher `artvibecamer.com` a l'hebergement — le DNS quitte alors
      `dns-parking.com` tout seul.
- [ ] Creer le sous-domaine `api.artvibecamer.com`.
- [ ] Activer **PHP 8.3** minimum (`composer.json` exige `^8.3`).
- [ ] Activer l'acces **SSH**.
- [ ] Creer une base MySQL, noter nom, utilisateur et mot de passe.
- [ ] Activer **HTTPS** sur les deux domaines avant toute mise en service.
      Un paiement qui transite en clair n'est pas acceptable, et Elgiopay
      n'appellera pas un webhook en HTTP.

**CDN** : l'activer sur `artvibecamer.com`, **pas** sur `api.artvibecamer.com`.
Un CDN devant l'API masque l'adresse du visiteur et fausse les limites de
debit, qui protegent le vote d'un bourrage automatise.

---

## 2. Backend Laravel

```bash
# Depuis le SSH Hostinger
cd ~/domains/artvibecamer.com
git clone git@github.com:russelfotie777-source/ArtVibeCamer.git depot
cd depot/backend

composer install --no-dev --optimize-autoloader
cp .env.example .env
php artisan key:generate
```

Puis la racine du sous-domaine `api.artvibecamer.com` doit pointer sur
`~/domains/artvibecamer.com/depot/backend/public`. **A VERIFIER** : selon les
plans, hPanel permet de changer la racine d'un sous-domaine ou impose
`public_html/api`. Dans le second cas, remplacer le dossier par un lien
symbolique vers `depot/backend/public`.

### `.env` de production

```dotenv
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.artvibecamer.com
FRONTEND_URL=https://artvibecamer.com

DB_CONNECTION=mysql
DB_HOST=localhost
DB_DATABASE=...
DB_USERNAME=...
DB_PASSWORD=...

# Laisser vide au depart, voir « Limites de debit » plus bas.
TRUSTED_PROXIES=

PAYMENT_DRIVER=elgiopay
PAYMENT_CURRENCY=XAF
ELGIOPAY_BASE_URL=https://sandbox-api.elgiopay.com
ELGIOPAY_SECRET_KEY=sk_...
ELGIOPAY_PUBLIC_KEY=pk_...
ELGIOPAY_AUTH_KEY=publique
ELGIOPAY_WEBHOOK_SECRET=whsec_...
```

`APP_DEBUG=false` n'est pas une preference : a `true`, une erreur affiche la
trace complete, les requetes SQL et le contenu de l'environnement — donc les
cles de paiement — a qui provoque l'erreur.

`ELGIOPAY_AUTH_KEY=publique` est un contournement, documente dans le
[journal](JOURNAL.md). A rebasculer sur `secrete` des qu'Elgiopay accepte la
cle secrete.

### Base et caches

```bash
php artisan migrate --force          # --force : pas de confirmation en production
php artisan db:seed --force          # categories, tarifs, reglages, compte admin
php artisan storage:link
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

**A VERIFIER** : `storage:link` cree un lien symbolique. Si l'hebergeur les
refuse, servir `storage/app/public` autrement, sinon aucune photo de candidat
ne s'affichera.

**Supprimer le compte du seeder** une fois les comptes nominatifs crees :
`admin@artvibecamer.cm` / `password` donne acces aux recettes et aux donnees
personnelles des candidats.

---

## 3. Frontend Next.js

Dans hPanel, creer une application Node.js sur `artvibecamer.com`, racine
`depot/frontend`, commande de demarrage `npm start`.

Variables d'environnement, **avant le build** — elles sont figees dedans :

```dotenv
NEXT_PUBLIC_API_URL=https://api.artvibecamer.com/api/v1
NEXT_PUBLIC_SITE_URL=https://artvibecamer.com
NEXT_PUBLIC_SITE_NAME=ArtVibeCamer
NODE_ENV=production
```

```bash
cd depot/frontend
npm ci
npm run build
```

`NEXT_PUBLIC_API_URL` sert aussi a autoriser l'hote des photos de candidats :
`next.config.ts` en deduit `images.remotePatterns`. Une valeur fausse laisse
passer le build et casse les fiches candidats a l'execution.

Le cookie de session passe en `secure` automatiquement quand `NODE_ENV` vaut
`production` : sans HTTPS sur le domaine, la connexion au back-office ne
fonctionnera pas.

---

## 4. Cron — non negociable

```cron
* * * * * cd ~/domains/artvibecamer.com/depot/backend && php artisan schedule:run >> /dev/null 2>&1
```

Sans cette entree, `payments:reconcile` ne tourne jamais. Un candidat qui
ferme son onglet avant la confirmation reste bloque en « en cours » jusqu'a
une verification manuelle depuis le back-office.

---

## 5. Elgiopay

Tableau de bord → Webhooks → URL des points de terminaison :

```
https://api.artvibecamer.com/api/v1/webhooks/payments/elgiopay
```

Le champ propose `https://yourapp.com/webhooks/elgiopay` en exemple : **ce
n'est pas notre chemin.**

Une fois l'URL declaree, les paiements se confirment en quelques secondes au
lieu de dependre du rattrapage toutes les cinq minutes, et la charge sur la
passerelle retombe.

**Passage en production** : les cles `_live_` ne sont delivrees qu'apres
approbation de l'application par Elgiopay. A demander tot. D'ici la, le bac a
sable reste en service et aucun argent reel ne circule.

---

## 6. Limites de debit et adresse du visiteur

Laravel plafonne les ecritures par adresse IP. Si tous les visiteurs
apparaissent avec la meme adresse, les plafonds bloquent tout le public des
les premieres inscriptions.

Marche a suivre, dans cet ordre :

1. Deployer avec `TRUSTED_PROXIES` vide.
2. Faire une inscription de bout en bout, puis lire `ip_address` dans
   `payment_webhooks` et les journaux.
3. Si l'adresse vue est celle d'un proxy et non celle du visiteur, renseigner
   `TRUSTED_PROXIES` avec cette adresse.

**Ne jamais mettre `*`** : n'importe qui pourrait alors annoncer l'adresse de
son choix et contourner tous les plafonds.

---

## 7. Verifications apres mise en ligne

Dans l'ordre, et avant d'annoncer l'ouverture :

- [ ] `https://api.artvibecamer.com/api/v1/categories` renvoie du JSON.
- [ ] La page d'accueil s'affiche, photos comprises.
- [ ] Connexion au back-office avec un compte nominatif.
- [ ] `php artisan elgiopay:diagnostic --scenario=699000000` depuis le serveur.
- [ ] **Une inscription complete avec un vrai numero**, jusqu'a la
      confirmation. Le bac a sable ne remplace pas ce test.
- [ ] La notification arrive : `payment_webhooks` contient une ligne avec
      `signature_valid = 1` et `processed_at` renseigne.
- [ ] Sauvegardes quotidiennes actives dans hPanel.

---

## Ce qui reste ouvert

- Le solde Elgiopay n'est pas affiche dans le back-office. L'argent encaisse
  s'accumule chez eux jusqu'a un retrait explicite : l'organisateur voit ce
  qui a ete encaisse, pas ce qui est retirable.
- Le taux de commission n'a ete mesure que sur une transaction MTN du bac a
  sable (2 %). Rien ne dit qu'il est identique sur Orange.
