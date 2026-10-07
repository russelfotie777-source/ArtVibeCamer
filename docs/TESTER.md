# Tester la plateforme

Comment dérouler les parcours à la main, et ce qu'il faut regarder.

---

## Démarrer

```bash
./demarrer.sh
```

Le script vérifie la base, les dépendances et la configuration, puis lance les
deux serveurs en arrière-plan.

| | |
| --- | --- |
| Site public | http://localhost:3000 |
| Back-office | http://localhost:3000/connexion |
| API | http://localhost:8000/api/v1/settings |

Compte de travail : `admin@artvibecamer.cm` / `password`

```bash
./arreter.sh            # tout arrêter
tail -f .logs/api.log   # suivre les erreurs Laravel
```

---

## Les deux modes de paiement

Le mode est choisi par `PAYMENT_DRIVER` dans `backend/.env`. **Après chaque
changement : `cd backend && php artisan config:clear`.**

### `fake` — par défaut, hors ligne

Aucun appel réseau, aucun débit, aucune charge chez Elgiopay. Le paiement
aboutit immédiatement, **sauf si le numéro finit par `0`**, ce qui simule un
refus.

C'est le mode à utiliser pour tout le travail courant : mise en page,
formulaires, back-office.

### `elgiopay` — contre leur bac à sable

```bash
PAYMENT_DRIVER=elgiopay
```

Le résultat dépend alors du numéro saisi :

| Numéro | Résultat |
| --- | --- |
| `677000000` / `699000000` | Paiement accepté |
| `677000202` / `699000202` | **Documenté** comme solde insuffisant |
| `677000201`, `…203`, `…204` | **Documentés** comme refus, délai dépassé, échec |

> **Attention** : au 7 octobre 2026, les numéros d'échec **aboutissent quand
> même**. Leur simulateur ne les implémente pas. Pour tester un échec,
> repassez en `fake` avec un numéro finissant par `0`.

N'enchaînez pas les essais inutilement : chaque tentative est un appel réel
chez eux.

---

## Parcours à dérouler

### 1. Inscription individuelle

http://localhost:3000/inscription

1. Catégorie **Chant**, formule **Individuel** → le récapitulatif doit
   afficher **8 000 FCFA**
2. Prénom, nom, téléphone `677000000`. **Laissez l'email vide** — il est
   facultatif
3. Cochez le règlement, envoyez

**À vérifier** : l'écran de suivi s'affiche, puis le numéro de candidat
apparaît — `AVC-CHA-001`. Notez la référence.

### 2. Inscription en groupe

1. Catégorie **Danse**, formule **En groupe** → le tarif passe à **10 000 FCFA**
2. Nom du groupe, puis **changez le nombre de membres** : les champs doivent
   apparaître et disparaître, et le récapitulatif suivre
3. Nommez chaque membre, envoyez

**À vérifier** : la fiche du candidat affiche toute la formation.

### 3. Miss & Master

Sélectionnez la catégorie : la formule **En groupe doit être grisée**, et le
tarif passer à **10 000 FCFA**. Le concours est individuel.

### 4. Paiement refusé et relance

En mode `fake`, inscrivez-vous avec un téléphone finissant par `0`
(`677000010`).

**À vérifier** : l'écran annonce l'échec, **aucun numéro n'est attribué**, et
un champ permet de relancer. Relancez avec un numéro valide — le dossier ne
doit **pas** être dupliqué.

### 5. Anti-doublon

Réinscrivez-vous avec un téléphone déjà utilisé : refus attendu, avec un
message explicite.

### 6. Back-office

http://localhost:3000/connexion

- **Tableau de bord** : les compteurs bougent. Les recettes affichent
  **net, brut et commission** — le net est ce que l'organisation touche
- **Candidats** : filtres par statut et catégorie, recherche par nom, numéro
  ou téléphone
- **Fiche** : validez un dossier. Son profil public devient visible. Essayez
  de valider un dossier impayé — ce doit être refusé
- **Paiements** : le bouton « Vérifier » n'apparaît que sur un paiement non
  tranché

### 7. Pages publiques

http://localhost:3000/candidats

Un candidat n'apparaît **qu'une fois validé**. Sur sa fiche, les votes
annoncent leur ouverture après les castings — c'est voulu, ils sont fermés
dans les réglages.

---

## Tests automatisés

```bash
cd backend
php artisan test                      # toute la suite
php artisan test --filter=ElgiopayTest
```

Ils portent sur les règles dont une régression coûte de l'argent : rejeu de
notification sans double comptage, montant non manipulable depuis le
navigateur, tarif selon la formule, cloisonnement des rôles.

Ils tournent sur la base `artvibecamer_test`, séparée de celle de
développement. **Aucun risque pour vos données.**

---

## Diagnostic Elgiopay

Vérifie l'intégration contre leur bac à sable. Demande une clé `pk_test_`
dans `backend/.env`.

```bash
cd backend
php artisan elgiopay:diagnostic                      # toute la batterie
php artisan elgiopay:diagnostic --scenario=677000000 # un seul numéro
```

La commande affiche le nombre d'appels consommés. La batterie complète en
fait **17, répartis sur 73 secondes**.

**Préférez `--scenario=` pour vérifier un point précis.** Rejouer les huit
scénarios multiplie la charge par huit sans rien apprendre de plus.

---

## Remettre à zéro

```bash
cd backend
php artisan migrate:fresh --seed
```

Efface tout et recrée les quatre catégories, les réglages et le compte
administrateur. **À faire dès que les données de test deviennent confuses** —
c'est plus rapide que de démêler.

---

## Quand ça ne marche pas

| Symptôme | Cause habituelle |
| --- | --- |
| « Le serveur a renvoyé une réponse inattendue » | L'API n'est pas démarrée. `tail -f .logs/api.log` |
| « Can't connect to local server through socket » | MySQL arrêté, ou `DB_SOCKET` absent sous XAMPP |
| Le paiement reste « en cours » | Normal avec Elgiopay sans webhook. `php artisan payments:reconcile` force la vérification |
| Un changement de `.env` sans effet | `php artisan config:clear` |
| Le site affiche d'anciennes données | Le back-office n'est jamais mis en cache ; rechargez. Si ça persiste, redémarrez |
