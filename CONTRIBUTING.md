# Conventions de travail

Projet a plusieurs mains et sous contrainte de calendrier. Ces conventions
existent pour qu'on puisse avancer en parallele sans se bloquer.

---

## Avant de coder

1. Lire [docs/JOURNAL.md](docs/JOURNAL.md) : etat d'avancement et point
   d'arret.
2. Verifier que les tests passent sur `main` : `cd backend && php artisan test`.
3. Annoncer dans le journal ou sur quoi vous partez, pour eviter que deux
   personnes attaquent le meme ecran.

---

## Branches

Une branche par sujet, partant de `main`.

```
feat/<sujet>      nouvelle fonctionnalite
fix/<sujet>       correction
refactor/<sujet>  reorganisation sans changement de comportement
docs/<sujet>      documentation seule
chore/<sujet>     outillage, dependances, configuration
```

Exemples : `feat/inscription-candidat`, `fix/jauge-billets-vip`,
`docs/contrat-api`.

Pas de commit direct sur `main`.

---

## Commits

Format :

```
<type>: <description a l'infinitif, en minuscule, sans point final>

<corps optionnel : pourquoi, pas comment>
```

Types : `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`.

```
feat: ajouter l'achat de votes payants

Le prix unitaire est lu dans la categorie et non recu du client,
pour qu'un montant envoye par le navigateur ne soit jamais pris
en compte.
```

Un commit = un changement coherent. Si la description a besoin d'un « et »,
c'est probablement deux commits.

Le corps du message sert a expliquer **pourquoi**. Le « comment » est dans le
diff.

---

## Pull requests

Titre identique a la convention de commit. Dans la description :

- ce que fait la PR, en deux ou trois phrases ;
- ce qui a ete verifie (tests automatises, parcours deroule a la main) ;
- les points qui restent ouverts, s'il y en a.

Une PR qui touche au paiement, aux compteurs de votes ou au controle a
l'entree demande une relecture attentive : ce sont les zones ou un bug coute
de l'argent ou de la credibilite le soir de l'evenement.

---

## Code backend

- **PSR-12.** `./vendor/bin/pint` avant de committer.
- **Logique metier dans `app/Services/`**, pas dans les controleurs. Un
  controleur valide, delegue, et formate la reponse.
- **Validation dans les Form Requests**, pas dans les controleurs.
- **Reponses via les API Resources**, jamais de modele serialise directement :
  c'est ce qui garantit que les donnees personnelles ne fuient pas.
- **Statuts en enums PHP** (`app/Enums/`), pas en chaines de caracteres.
- **Jamais de montant recu du client.** Les prix sont lus en base.
- **Toute mutation d'argent ou de compteur de votes** passe par une
  transaction SQL et doit etre idempotente.

### Commentaires

On commente **pourquoi**, pas **quoi**. Un commentaire qui paraphrase la ligne
suivante est du bruit ; un commentaire qui explique une contrainte non
evidente fait gagner une heure a la personne suivante.

```php
// Verrou sur la categorie : deux inscriptions payees au meme instant
// ne doivent pas recevoir le meme numero.
$category = Category::query()->lockForUpdate()->find($candidate->category_id);
```

---

## Code frontend

- TypeScript strict, pas de `any` non justifie.
- Tous les appels API passent par `src/lib/api.ts`. Pas de `fetch` disperse
  dans les composants : sinon la gestion des erreurs et du jeton se duplique.
- Types derives de [docs/API.md](docs/API.md). Si l'API change, le contrat est
  mis a jour en meme temps.
- Composants serveur par defaut, `"use client"` seulement quand c'est
  necessaire (formulaires, etat local, polling de paiement).
- Montants affiches avec un espace comme separateur de milliers et le suffixe
  FCFA : `15 000 FCFA`.

---

## Tests

Les tests existants couvrent les invariants d'argent. Toute modification du
paiement, des votes ou de la billetterie doit **passer les tests existants**
et, si elle ajoute une regle, en ajouter un.

```bash
cd backend
php artisan test
php artisan test --filter=VotingTest
```

Les tests tournent sur la base `artvibecamer_test`, separee de la base de
developpement.

---

## Base de donnees

- Toute modification de schema passe par une migration. **Jamais de
  `ALTER TABLE` a la main** : la machine du voisin ne le verrait pas.
- Ne jamais modifier une migration deja poussee sur `main` : en ajouter une
  nouvelle.
- Les seeders doivent etre rejouables sans ecraser des donnees existantes
  (`firstOrCreate`).

---

## A ne jamais committer

- `.env` et toute variante contenant des credentials.
- `vendor/`, `node_modules/`, `.next/`.
- Cles d'API de passerelle de paiement, meme en commentaire, meme sur une
  branche.
- Dumps de base contenant des donnees personnelles de candidats.

Si un secret est committe par erreur : le revoquer chez l'operateur **avant**
de reecrire l'historique. Retirer le fichier ne suffit pas, il reste dans les
objets Git.

---

## Mise a jour du journal

A la fin de chaque session de travail, mettre a jour
[docs/JOURNAL.md](docs/JOURNAL.md) :

- ce qui a avance ;
- ou vous vous etes arrete exactement ;
- ce qui reste a faire ensuite ;
- tout piege rencontre, pour que le suivant ne le redecouvre pas.

C'est ce qui permet a quelqu'un d'autre de reprendre le lendemain sans avoir a
reconstituer le contexte.
