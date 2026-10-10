# Schema de la base de donnees

MySQL 8 / MariaDB 10.4+, `utf8mb4_unicode_ci`.

> MariaDB 10.4 ne connait pas `utf8mb4_0900_ai_ci` (propre a MySQL 8). Rester
> sur `utf8mb4_unicode_ci` pour que le projet tourne sur les deux moteurs.

Tous les montants sont des **entiers de FCFA**. Voir
[ARCHITECTURE.md](ARCHITECTURE.md#2-largent-en-nombres-entiers).

---

## Vue d'ensemble

```
categories ──┬── candidates ──┬── votes ──┐
             │                │           │
             └── votes ───────┘           ├── transactions (payable polymorphe)
                                          │
ticket_types ─── ticket_order_items ──────┤
                      │                   │
                 ticket_orders ───────────┘
                      │
                   tickets ─── scan_logs

transactions ─── payment_webhooks
users ─── activity_logs
settings  (cle / valeur)
```

---

## `users`

Comptes de l'equipe. Pas de compte candidat ni de compte votant : les
candidats sont identifies par leur dossier, les votants par leur paiement.

| Colonne | Note |
| --- | --- |
| `role` | `super_admin`, `admin`, `moderator`, `scanner` |
| `is_active` | Desactiver un compte sans le supprimer |
| `last_login_at`, `last_login_ip` | Suivi des acces au back-office |

Soft deletes. Comptes crees par `php artisan user:create`.

---

## `settings`

Configuration de l'evenement, modifiable depuis le back-office.

| Colonne | Note |
| --- | --- |
| `key` | Unique. Les cles connues du code sont listees dans `SettingSeeder` |
| `type` | `string`, `integer`, `boolean`, `json`, `datetime` — pilote le cast a la lecture |
| `is_public` | Seules ces cles sortent sur `GET /api/v1/settings` |

Cles lues par le code metier : `registration_enabled`, `voting_enabled`,
`ticketing_enabled`, `results_public`, `show_vote_counts`,
`auto_approve_candidates`.

---

## `categories`

| Colonne | Note |
| --- | --- |
| `registration_fee` | Tarif **individuel** en FCFA |
| `group_fee` | Tarif **groupe**. `NULL` = la categorie ne se presente qu'en individuel (cas de Miss & Master) |
| `max_group_members` | Plafond de membres d'un groupe |
| `tagline` | Accroche de la discipline, reprise des affiches |
| `vote_price` | Prix d'une voix en FCFA |
| `max_candidates` | `NULL` = pas de plafond |
| `registration_opens_at` / `closes_at` | `NULL` = on retombe sur les reglages globaux |
| `voting_opens_at` / `closes_at` | Idem |
| `candidates_count` | **Denormalise.** Incremente a la confirmation d'un paiement d'inscription |
| `votes_count` | **Denormalise.** Incremente a la confirmation d'un paiement de vote |

Resolution d'URL par `slug`. Soft deletes.

---

## `candidates`

| Colonne | Note |
| --- | --- |
| `candidate_number` | `AVC-MUS-014`. **`NULL` jusqu'au paiement des frais.** Hors `$fillable` : seul `RegistrationFulfilment` l'attribue |
| `slug` | Genere a la creation, unique, resolution d'URL publique |
| `registration_type` | `solo` ou `group` |
| `group_name` | Nom de la formation. C'est lui qui est affiche au public pour un groupe |
| `members_count` | **Denormalise** depuis `candidate_members` |
| `phone` | **Unique globalement** — cle anti-doublon d'inscription |
| `email` | **Facultatif**, unique parmi les adresses fournies. MySQL autorise plusieurs `NULL` dans un index unique |
| `status` | `draft`, `awaiting_payment`, `pending_review`, `active`, `rejected`, `withdrawn`, `eliminated` |
| `votes_count` | **Denormalise.** Hors `$fillable` |
| `socials` | JSON : `facebook`, `instagram`, `tiktok`, `youtube`, `x` |
| `reviewed_by`, `reviewed_at`, `rejection_reason` | Circuit de validation |

Index `candidates_ranking_index (category_id, status, votes_count)` : c'est
lui qui rend le classement public rapide.

Unicite sur l'email et le telephone **globale et non par categorie** : un
artiste ne doit pas pouvoir s'inscrire deux fois en changeant simplement de
categorie.

---

## `candidate_members`

Membres declares d'une inscription en groupe. La liste sert au controle le
jour du casting : on verifie que les personnes presentes sont celles
annoncees.

| Colonne | Note |
| --- | --- |
| `candidate_id` | Supprime en cascade avec le dossier |
| `full_name` | Nom et prenom tels que saisis |
| `photo_path` | **Facultative** : tous les candidats n'en ont pas une sous la main |
| `position` | Ordre de saisie dans le formulaire |

---

## `transactions`

Journal unique des trois flux d'encaissement.

| Colonne | Note |
| --- | --- |
| `reference` | `AVC-VOT-2026-7F3K9A2B`. Lisible, non sequentielle : ne divulgue pas le volume de transactions |
| `type` | `registration`, `vote`, `ticket` |
| `payable_type` / `payable_id` | Polymorphe vers `Candidate`, `Vote` ou `TicketOrder` |
| `status` | `pending`, `processing`, `succeeded`, `failed`, `cancelled`, `expired`, `refunded` |
| `provider` | `fake`, `elgiopay`, `manual` |
| `provider_reference` | Identifiant cote operateur. Indexe : sert a retrouver la transaction depuis un webhook |
| `idempotency_key` | Unique. Empeche le double encaissement si le formulaire est re-soumis |
| `expires_at` | Delai de validation par le payeur (`PAYMENT_TIMEOUT_MINUTES`) |
| `metadata` | JSON des echanges avec la passerelle, **credentials retires** avant ecriture |

Index `transactions_reporting_index (type, status, paid_at)` : la requete la
plus frequente du tableau de bord.

---

## `votes`

**Une ligne = un achat de N voix**, pas une ligne par voix.

| Colonne | Note |
| --- | --- |
| `quantity` | Nombre de voix du lot |
| `unit_price`, `total_amount` | Tarif fige a l'achat |
| `category_id` | Denormalise depuis le candidat : evite une jointure sur tous les agregats par categorie |
| `status` | `pending`, `confirmed`, `failed`, `cancelled`. **Seul `confirmed` compte dans les classements** |
| `ip_address`, `user_agent`, `fingerprint` | Signaux anti-fraude conserves pour analyse a posteriori |
| `cancelled_by`, `cancellation_reason` | Annulation d'un lot frauduleux |

> **Attention** : le total des voix d'un candidat est
> `SUM(quantity) WHERE status = 'confirmed'`, pas `COUNT(*)`. C'est une erreur
> facile a faire en ajoutant une statistique.

---

## `ticket_types`

| Colonne | Note |
| --- | --- |
| `quantity_total` | `NULL` = jauge illimitee |
| `quantity_sold` | Places vendues et payees |
| `quantity_reserved` | Places immobilisees par un paiement en cours |
| `max_per_order` | Plafond par commande |

Disponible = `quantity_total - quantity_sold - quantity_reserved`.
La jauge restante **n'est pas exposee au public**.

---

## `ticket_orders` et `ticket_order_items`

`ticket_orders` porte l'acheteur et le total ; `ticket_order_items` detaille
quelle categorie de place en quelle quantite.

**Pourquoi cette seconde table** : les billets ne sont emis qu'apres paiement.
C'est donc elle qui dit quoi emettre, et quelle jauge liberer si la commande
expire. Le tarif y est fige (`unit_price`) pour qu'un changement de prix ne
reecrive pas l'historique des ventes.

---

## `tickets`

Un billet par place achetee. **N'existe qu'apres paiement confirme.**

| Colonne | Note |
| --- | --- |
| `code` | `AVC-T-7F3K9A`. Alphabet sans `0/O/1/I/L` : dictable au telephone sans confusion |
| `qr_token` | 256 bits aleatoires, unique. **Vaut droit d'entree** — `$hidden` par defaut, expose seulement au porteur de la commande et a l'equipe |
| `status` | `valid`, `used`, `cancelled` |
| `scan_count` | Nombre de presentations, refus compris. Plusieurs tentatives apres un premier passage = signal de fraude |

---

## `scan_logs`

Trace de chaque presentation a l'entree, **y compris les refus**.

`result` : `accepted`, `already_used`, `not_found`, `cancelled`,
`order_unpaid`.

Le `qr_token` n'est jamais journalise en clair — c'est le `code` court qui
sert de reference.

---

## `payment_webhooks`

Toute notification entrante est persistee **telle quelle, avant tout
traitement metier**.

| Colonne | Note |
| --- | --- |
| `event_id` | **Unique.** Cle d'idempotence : un rejeu est acquitte sans etre retraite |
| `signature_valid` | Une notification non authentifiee est enregistree puis rejetee |
| `payload` | Contenu brut. En cas de litige sur un encaissement, seule preuve de ce que la passerelle a envoye |
| `processed_at` | `NULL` = a reprendre. Alimente les alertes du tableau de bord |

---

## `activity_logs`

Historique des operations sensibles du back-office : validation d'un candidat,
annulation de votes, changement de tarif, export de donnees.

Ecriture seule (`UPDATED_AT = null`) : une ligne d'audit ne se modifie pas.

Actions journalisees : `auth.login`, `candidate.approved`,
`candidate.rejected`, `candidate.updated`, `candidate.deleted`,
`category.created|updated|deleted`, `ticket_type.*`, `votes.cancelled`,
`transaction.verified`, `settings.updated`, `export.*`.

---

## Sauvegardes

Rien n'est automatise pour l'instant. **A mettre en place avant l'ouverture
des votes** — voir [JOURNAL.md](JOURNAL.md). Une base contenant des
encaissements sans sauvegarde est un risque qu'on ne peut pas porter le soir
de l'evenement.

Sauvegarde manuelle :

```bash
mysqldump -u root artvibecamer > sauvegarde-$(date +%F-%H%M).sql
```
