# Contrat d'API

Base : `http://localhost:8000/api/v1` en developpement.

Toutes les reponses sont en JSON. Envoyer `Accept: application/json` sur
chaque requete, sinon Laravel peut tenter une redirection HTML.

Les listes paginees suivent le format Laravel : `{ data: [...], links: {...},
meta: {...} }`. Les ressources simples sont enveloppees dans `data`.

---

## Conventions

| Sujet | Regle |
| --- | --- |
| Montants | Entiers de FCFA. `15000` signifie 15 000 FCFA |
| Dates | ISO 8601 avec fuseau (`2026-10-10T19:00:00+01:00`) |
| Telephones | Normalises en `237XXXXXXXXX` par le serveur. Le client peut envoyer `671 23 45 67` ou `+237671234567` |
| Erreurs de validation | HTTP 422, `{ message, errors: { champ: [messages] } }` |
| Ressource absente | HTTP 404, `{ message }` |
| Non authentifie | HTTP 401 |
| Droits insuffisants | HTTP 403 |
| Trop de requetes | HTTP 429 |

**Identifiants dans les URL** : le site public utilise des `slug` (candidats,
categories) et des `reference` (commandes, paiements) ; le back-office utilise
des identifiants numeriques.

---

# Espace public

Aucune authentification.

## Reglages de l'evenement

```http
GET /settings
```

```json
{
  "data": {
    "event_name": "ArtVibeCamer",
    "event_tagline": "La culture, les talents et l'art camerounais sur une seule scene",
    "event_date": null,
    "event_venue": null,
    "event_city": "Douala",
    "registration_enabled": true,
    "voting_enabled": true,
    "ticketing_enabled": true,
    "results_public": true,
    "show_vote_counts": true
  }
}
```

A appeler au chargement du site : les interrupteurs disent quels parcours
afficher.

## Categories

```http
GET /categories
GET /categories/{slug}?per_page=24
```

Champs utiles : `registration_fee`, `vote_price`, `candidates_count`,
`votes_count`, `is_registration_open`, `is_voting_open`, `is_full`.

Le detail renvoie en plus les candidats de la categorie, classes par voix,
dans une cle `candidates` paginee.

## Candidats

```http
GET /candidates?category={slug}&search={texte}&per_page=24
GET /candidates/{slug}
```

Le detail ajoute `meta.rank` (rang dans la categorie) et
`meta.category_candidates`.

Champs publics : `candidate_number`, `display_name`, `photo_url`,
`presentation`, `city`, `socials`, `votes_count`, `is_votable`.
Les donnees personnelles (nom civil, telephone, email) **ne sont jamais
renvoyees** sans authentification back-office.

## Resultats

```http
GET /results?limit=10
```

Classement par categorie. Renvoie **403** si `results_public` est a `false`.
Si `show_vote_counts` est a `false`, les `votes_count` valent `null` : le
classement reste visible sans les scores.

## Inscription d'un candidat

```http
POST /registrations
Content-Type: multipart/form-data
```

| Champ | Requis | Note |
| --- | --- | --- |
| `category_id` | oui | |
| `first_name`, `last_name` | oui | |
| `stage_name` | non | Nom affiche publiquement s'il est fourni |
| `email` | oui | Unique |
| `phone` | oui | Mobile camerounais, unique |
| `whatsapp` | non | |
| `city`, `region`, `gender`, `date_of_birth` | non | |
| `presentation` | non | 2000 caracteres max |
| `photo` | non | jpg/png/webp, 4 Mo max |
| `socials[facebook]`, `socials[instagram]`, `socials[tiktok]`, `socials[youtube]` | non | URLs |
| `payer_phone` | non | Numero a debiter s'il differe du numero de contact |
| `accepts_terms` | oui | Doit valoir `1` |

`multipart/form-data` est necessaire a cause de la photo. Sans photo, du JSON
fonctionne aussi.

**201 Created** :

```json
{
  "message": "Inscription enregistree. Validez le paiement des frais sur votre telephone.",
  "candidate": { "slug": "arno-vibe", "candidate_number": null, "status": "awaiting_payment" },
  "transaction": { "reference": "AVC-INS-2026-X2AQYWFS", "amount": 15000, "status": "processing" },
  "payment": {
    "instructions": "Composez *126# sur votre telephone pour valider le paiement.",
    "redirect_url": null
  }
}
```

Suite du parcours : afficher `payment.instructions`, ou rediriger vers
`payment.redirect_url` s'il est present, puis interroger
`GET /payments/{reference}` jusqu'a ce que `is_final` soit `true`.

`candidate_number` reste `null` tant que le paiement n'est pas confirme.

## Achat de votes

```http
POST /candidates/{slug}/votes
Content-Type: application/json
```

```json
{ "quantity": 25, "voter_name": "Clarisse Mbarga", "voter_phone": "699887766", "voter_email": null }
```

Seuls `quantity` et `voter_phone` sont requis.

> **Le montant n'est pas un parametre.** Le prix unitaire est lu dans la
> categorie du candidat. Tout `unit_price`, `amount` ou `total_amount` envoye
> par le client est ignore.

**201 Created** : `vote` (reference, quantity, total_amount, status),
`transaction`, `payment`. Les voix ne sont creditees qu'apres confirmation.

Erreurs 422 : candidat non valide, votes fermes pour la categorie, quantite
hors bornes.

## Billetterie

```http
GET /ticket-types
```

Champs : `name`, `price`, `is_on_sale`, `is_sold_out`, `max_purchasable`.
La jauge restante n'est pas exposee.

```http
POST /ticket-orders
Content-Type: application/json
```

```json
{
  "items": [
    { "ticket_type_id": 2, "quantity": 2 },
    { "ticket_type_id": 1, "quantity": 1 }
  ],
  "buyer_name": "Serge Etoa",
  "buyer_phone": "677112233",
  "buyer_email": "serge@example.cm"
}
```

**201 Created** : `order` (reference, quantity, total_amount, status),
`transaction`, `payment`.

Erreurs 422 : categorie non en vente, stock insuffisant (le message indique
le restant), plafond par commande depasse.

## Recuperation des billets

```http
GET /ticket-orders/{reference}
```

La reference de commande est aleatoire et connue du seul acheteur : c'est elle
qui autorise l'acces. Si la commande est payee, chaque billet porte son
`qr_token`, a encoder en QR code cote front.

```json
{
  "data": {
    "reference": "AVC-C-KPL4DNV3T5",
    "status": "paid",
    "tickets": [
      { "code": "AVC-T-CE4GPF", "type": { "name": "VIP" }, "status": "valid", "qr_token": "qrCi1hjy..." }
    ]
  }
}
```

## Suivi d'un paiement

```http
GET /payments/{reference}
```

A interroger pendant que l'utilisateur valide sur son telephone.

| Champ | Usage cote front |
| --- | --- |
| `status` | `pending`, `processing`, `succeeded`, `failed`, `cancelled`, `expired` |
| `status_label` | Libelle francais pret a afficher |
| `is_final` | `true` = arreter d'interroger |
| `is_awaiting_payer` | `true` = le payeur peut encore valider |
| `failure_reason` | Motif a afficher en cas d'echec |

Interroger toutes les 3 a 5 secondes, 2 minutes maximum. Si le webhook se
fait attendre, cette route interroge elle-meme la passerelle.
Limite : 60 appels par minute et par IP.

## Notifications de paiement

```http
POST /webhooks/payments/{provider}
```

Appelee par la passerelle, pas par le front. Repond toujours `200`, y compris
sur rejet : une passerelle qui recoit une erreur rejoue indefiniment.

En developpement, avec `PAYMENT_DRIVER=fake`, permet de simuler une
notification :

```bash
curl -X POST http://localhost:8000/api/v1/webhooks/payments/fake \
  -H "Content-Type: application/json" \
  -d '{"reference":"AVC-VOT-2026-FJICMMTR","status":"succeeded","event_id":"EVT-1"}'
```

---

# Back-office

`Authorization: Bearer {token}` sur toutes les routes sauf `login`.

## Connexion

```http
POST /admin/login
{ "email": "...", "password": "...", "device_name": "back-office" }
```

Renvoie `token` et `user` (dont `capabilities`, a utiliser pour afficher ou
masquer les ecrans).

`device_name` cree un jeton par appareil : revoquer un telephone perdu le soir
de l'evenement ne deconnecte pas toute l'equipe.

Verrouillage apres 5 tentatives echouees sur le meme couple email / IP.

```http
POST /admin/logout
GET  /admin/me
```

## Droits par route

| Capacite | Roles | Routes |
| --- | --- | --- |
| `canScan` | super_admin, admin, scanner | `/admin/scan`, `/admin/scan/stats` |
| `canAccessBackOffice` | tous sauf scanner | Lectures : dashboard, candidats, votes, transactions, commandes, exports |
| `canModerate` | super_admin, admin, moderator | Validation et rejet des candidats |
| `canManage` | super_admin, admin | Ecritures : categories, tarifs, jauges, annulation de votes, reglages |

## Tableau de bord

```http
GET /admin/dashboard?days=14
```

```json
{
  "overview": {
    "candidates": { "total": 400, "paid": 350, "pending_review": 12, "active": 338 },
    "votes": { "total": 12500, "orders": 820 },
    "tickets": { "sold": 850, "checked_in": 412 },
    "revenue": { "registrations": 5250000, "votes": 1250000, "tickets": 4250000, "total": 10750000, "currency": "XAF" },
    "payments": { "succeeded": 1820, "pending": 4, "failed": 96 }
  },
  "by_category": [ { "name": "Musique", "candidates_count": 64, "votes_count": 3400, "vote_revenue": 340000 } ],
  "timeline": [ { "date": "2026-10-07", "votes": 820, "revenue": 112000, "registrations": 9, "tickets": 41 } ],
  "leaderboard": [ { "position": 1, "candidate_number": "AVC-MUS-014", "name": "Arno Vibe", "votes_count": 1240 } ],
  "entrance": { "tickets_issued": 850, "checked_in": 412, "rate": 48.5, "rejected_scans": 7 },
  "alerts": { "stale_transactions": 0, "unprocessed_webhooks": 0, "invalid_signatures": 0, "expired_orders": 0 }
}
```

`timeline` renvoie tous les jours de la periode, zeros compris : le front n'a
pas de trous a combler dans ses graphiques.

`alerts` merite un bandeau visible : une valeur non nulle signale des
paiements bloques ou des notifications non traitees.

## Candidats

```http
GET    /admin/candidates?status=&category_id=&unpaid=1&search=&per_page=25
GET    /admin/candidates/{id}
PATCH  /admin/candidates/{id}
DELETE /admin/candidates/{id}
POST   /admin/candidates/{id}/approve
POST   /admin/candidates/{id}/reject   { "reason": "..." }
```

`approve` renvoie **422** si les frais ne sont pas encaisses.
`DELETE` renvoie **422** si le candidat a recu des voix payantes : utiliser le
statut `withdrawn` a la place.

## Categories et billetterie

```http
GET    /admin/categories
POST   /admin/categories
PATCH  /admin/categories/{id}
DELETE /admin/categories/{id}

GET    /admin/ticket-types
POST   /admin/ticket-types
PATCH  /admin/ticket-types/{id}
DELETE /admin/ticket-types/{id}
```

Reduire `quantity_total` sous le nombre de places deja vendues ou reservees
renvoie **422**. Supprimer une categorie contenant des candidats, ou une
categorie de billet dont des billets sont emis, renvoie **422** : desactiver
plutot que supprimer.

## Votes

```http
GET  /admin/votes?candidate_id=&category_id=&status=&phone=&ip=
GET  /admin/votes/suspicious?threshold=10
POST /admin/votes/{id}/cancel   { "reason": "..." }
```

`suspicious` liste les concentrations anormales par IP et par empreinte de
navigateur. **Rien n'est bloque automatiquement** : l'annulation est une
decision de l'organisation. Elle retire les voix du compteur du candidat.

## Transactions

```http
GET  /admin/transactions?type=&status=&search=&from=&to=
GET  /admin/transactions/{reference}
POST /admin/transactions/{reference}/verify
```

`verify` interroge la passerelle et applique l'etat reel. C'est la reponse a
un client qui affirme avoir ete debite sans avoir recu sa contrepartie :
plutot que de valider a la main, on redemande son etat a l'operateur.

## Commandes de billets

```http
GET /admin/ticket-orders?status=&search=
GET /admin/ticket-orders/{reference}
```

## Controle a l'entree

```http
POST /admin/scan
{ "code": "<qr_token ou AVC-T-XXXXXX>", "gate": "Entree principale" }
```

**Repond toujours 200**, meme sur refus : l'agent a besoin d'un verdict
immediat, pas d'un code HTTP a interpreter dans le bruit de l'entree.

```json
{
  "granted": false,
  "result": "already_used",
  "message": "Billet deja utilise",
  "ticket": { "code": "AVC-T-CE4GPF", "holder_name": "Serge Etoa", "type": "VIP", "used_at": "...", "scan_count": 2 }
}
```

`result` : `accepted`, `already_used`, `not_found`, `cancelled`,
`order_unpaid`.

Le front doit se baser sur `granted` (booleen) et afficher `message`.
`used_at` permet de dire a l'agent quand le billet est deja passe.

```http
GET /admin/scan/stats
```

Compteur d'entrees en temps reel et 20 derniers scans.

## Reglages

```http
GET /admin/settings
PUT /admin/settings
{ "settings": [ { "key": "voting_enabled", "value": "0" } ] }
```

Une cle inconnue est ignoree silencieusement : creer une cle que le code ne
lit pas donnerait l'illusion d'avoir agi.

## Exports CSV

```http
GET /admin/exports/candidates?category_id=&status=
GET /admin/exports/votes?status=
GET /admin/exports/transactions?type=&status=
GET /admin/exports/tickets
```

Fichiers streames, separateur `;` et BOM UTF-8 : ouverture directe dans Excel
en locale francaise, accents compris.

---

## Limites de debit

| Route | Limite |
| --- | --- |
| Toute l'API | 90 / min / IP |
| `POST /registrations` | 8 / heure / IP |
| `POST /candidates/{slug}/votes`, `POST /ticket-orders` | 10 / min et 60 / heure / IP |
| `GET /payments/{reference}` | 60 / min / IP |
| `POST /admin/login` | 10 / min / IP et 5 / min / email |
| `POST /admin/scan` | 240 / min / agent |
| Webhooks | 300 / min / IP |
