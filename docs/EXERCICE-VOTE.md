# Exercice : reconstruire le backend des votes

Cette branche (`exercice/backend-vote`) a été volontairement amputée de la
logique métier des votes. L'objectif est de la reconstruire, en s'appuyant sur
les tests existants comme cahier des charges.

**`main` n'est pas touchée** : le backend des votes y est complet et c'est lui
qui tourne en production. Cette branche ne doit pas être déployée.

## Critère de réussite

```bash
cd backend
php artisan test
```

Aujourd'hui : **50 tests au vert, 20 en échec**. Le travail est terminé quand
la suite complète repasse à **70 sur 70**, sans toucher aux tests.

Les 20 échecs sont les seuls attendus :

| Fichier | En échec | Ce qu'il vérifie |
| --- | --- | --- |
| `tests/Feature/VotingTest.php` | 7 sur 7 | Les règles métier des votes |
| `tests/Feature/ElgiopayTest.php` | 13 sur 17 | La passerelle de paiement, qui utilise l'achat de voix comme véhicule de test |

Ne modifier aucun test pour le faire passer. Si un test semble faux, le
signaler plutôt que de le réécrire.

## Ce qui a été retiré

| Fichier | Rôle |
| --- | --- |
| `app/Services/Voting/VoteService.php` | Achat d'un lot de voix, annulation |
| `app/Services/Payments/Fulfilment/VoteFulfilment.php` | Crédit des voix après paiement |
| `app/Http/Controllers/Api/V1/Site/VoteController.php` | Route publique d'achat |
| `app/Http/Controllers/Api/V1/Admin/VoteController.php` | Liste, détection de fraude, annulation |
| `app/Http/Requests/StoreVoteRequest.php` | Validation de l'achat |
| `app/Http/Resources/VoteResource.php` | Forme de la réponse JSON |
| `routes/api.php` | Les quatre routes correspondantes |

Dans `PaymentProcessor::fulfilmentFor()`, le cas `TransactionType::Vote` lève
désormais une exception : c'est le point d'ancrage du crédit des voix.

## Ce qui a été conservé

- Le modèle `Vote`, l'énumération `VoteStatus` et la migration de la table
  `votes` : **ne pas modifier le schéma**, la base de production le partage.
- Les compteurs `candidates.votes_count` et `categories.votes_count`.
- Le classement (`GET /api/v1/results`), les statistiques, la commande
  `counters:recalculate` et l'export CSV des votes, qui ne font que lire.
- La configuration `config/payments.php` (`votes.min_quantity`,
  `votes.max_quantity`).

## Cahier des charges

### 1. Achat de voix

`POST /api/v1/candidates/{candidate}/votes`, protégé par le limiteur
`throttle:checkout`.

Corps :

| Champ | Règle |
| --- | --- |
| `quantity` | obligatoire, entier, entre `payments.votes.min_quantity` et `max_quantity` |
| `voter_phone` | obligatoire, numéro camerounais (règle `CameroonPhone`, à normaliser avant validation) |
| `voter_name` | facultatif, 120 caractères au plus |
| `voter_email` | facultatif, adresse valide |

Règles métier :

- Le candidat doit être votable (`Candidate::isVotable()`) et le scrutin de sa
  catégorie ouvert (`Category::isVotingOpen()`). Sinon, erreur de validation.
- **Le montant n'est jamais lu dans la requête.** Il vaut
  `category.vote_price × quantity`, en entiers de FCFA, et doit rester dans
  les bornes `payments.min_amount` et `payments.max_amount`.
- La création du lot (`Vote`, statut `pending`) et de sa `Transaction`
  (type `vote`, rattachée au lot) se fait **dans une seule transaction SQL**.
- Conserver l'adresse IP, le user-agent et une empreinte (`fingerprint`) : la
  détection de fraude (point 3) s'appuie dessus.
- Le paiement est ensuite lancé par `PaymentProcessor::start()`.

Réponse `201` :

```json
{
  "message": "...",
  "vote": { ... },
  "transaction": { ... },
  "payment": { "instructions": "...", "redirect_url": null }
}
```

Le frontend existant (`/candidats/[slug]/voter`) attend exactement cette
forme. `vote` expose : `reference`, `quantity`, `unit_price`, `total_amount`,
`status`, `status_label`, `confirmed_at`, `created_at`, plus `candidate` et
`transaction` quand ils sont chargés. Les champs sensibles (`voter_name`,
`voter_phone`, `voter_email`, `ip_address`, `fingerprint`, motif et date
d'annulation) ne sortent que pour un utilisateur du back-office.

### 2. Crédit après paiement

À implémenter dans une classe `VoteFulfilment` respectant l'interface
`Fulfilment` (`fulfil` et `revert`). `RegistrationFulfilment` sert de modèle.

- `fulfil` : passer le lot à `confirmed`, renseigner `confirmed_at`, et
  incrémenter les deux compteurs (candidat et catégorie) de `quantity`.
- **Idempotent.** La passerelle rejoue ses notifications jusqu'à obtenir un
  2xx : un lot déjà confirmé ne doit jamais être recompté.
- `revert` : si le lot était confirmé, retirer les voix des compteurs ; dans
  tous les cas, passer le lot à `failed`.
- Un paiement refusé ne crédite aucune voix.

### 3. Modération (back-office)

| Route | Droits | Comportement |
| --- | --- | --- |
| `GET /api/v1/admin/votes` | back-office | Liste paginée, du plus récent au plus ancien. Filtres : `candidate_id`, `category_id`, `status`, `phone` (recherche partielle), `ip`. `per_page` plafonné à 100 |
| `GET /api/v1/admin/votes/suspicious` | back-office | Regroupe les lots **confirmés** par adresse IP puis par empreinte, et garde les groupes d'au moins `threshold` achats (10 par défaut, jamais moins de 2). 50 lignes au plus, triées par nombre de voix |
| `POST /api/v1/admin/votes/{vote:id}/cancel` | `can.do:canManage` | `reason` obligatoire (255 caractères au plus). Seul un lot **confirmé** est annulable. Retire les voix des deux compteurs, passe le lot à `cancelled` et renseigne `cancelled_by`, `cancelled_at`, `cancellation_reason`. Écrit une entrée d'audit `votes.cancelled` via `Audit::log()` |

L'annulation se fait sous verrou (`lockForUpdate`), dans une transaction.

## Contraintes qui valent pour tout le projet

- Montants en **FCFA, entiers uniquement**, jamais de `float`.
- Toute écriture touchant un montant ou un compteur de voix passe par une
  **transaction SQL** et doit être **idempotente**.
- Rien n'est délivré avant paiement : une voix en base est une voix payée.
- Messages d'erreur destinés au public en français.

## Lancer les tests

Les tests s'exécutent sur la base `artvibecamer_test`, séparée de celle de
développement.

```bash
sudo /opt/lampp/lampp startmysql      # MariaDB doit tourner
cd backend
php artisan test --filter=VotingTest
```

## Hors périmètre, et pistes pour la suite

Le frontend n'est pas concerné : la page d'achat fonctionnera de nouveau dès
que l'API répondra. Restent à faire, une fois le backend terminé :

- l'écran de confirmation d'un vote, qui affiche aujourd'hui un texte propre
  aux inscriptions ;
- la relance d'un paiement de vote échoué, qui n'existe que pour les
  inscriptions ;
- la page publique du classement ;
- les écrans de modération du back-office.
