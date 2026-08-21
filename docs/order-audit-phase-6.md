# Audit des commandes - Phase 6

Date : 30 juillet 2026

## Perimetre

- Creation et idempotence des commandes
- References uniques
- Expiration automatique
- Confirmation et retrait du stock
- Annulation et restauration du stock
- Terminaison
- Articles ajoutes hors catalogue
- Concurrence sur le stock
- Calcul du chiffre d'affaires

## Etat trouve

### Deja en place

- Le panier cree une commande `pending` avant l'ouverture de WhatsApp.
- `clientRequestId` est unique et evite de creer deux commandes lorsqu'une
  cliente renvoie la meme demande.
- `reference` possede un index MongoDB unique.
- Les routes publiques sont validees avec Zod et limitees en frequence.
- Toutes les routes de gestion sont protegees par l'authentification admin.
- Une commande en attente ne retire aucun stock.
- La confirmation retire le stock et cree les mouvements dans une transaction
  MongoDB.
- L'annulation d'une commande confirmee restaure le stock une seule fois dans
  une transaction.
- Une commande annulee avant confirmation ne modifie pas le stock.
- Les commandes en attente expirent au demarrage, toutes les 15 minutes et
  avant leur chargement dans le backoffice.
- L'expiration ne modifie pas le stock.
- L'administratrice peut completer une commande avec un article hors catalogue.
- Le chiffre d'affaires utilise uniquement les commandes `completed`.
- Les articles sans prix numerique sont exclus du montant et comptes
  separement comme non chiffres.
- Les changements de statut et de stock sont conserves dans le journal
  d'activite.

## Anomalies confirmees

### Controle du stock contournable par des lignes identiques

Deux lignes publiques contenant le meme produit et la meme couleur etaient
controlees separement. Avec 5 articles en stock, deux lignes de 3 pouvaient donc
creer une commande en attente de 6 articles. La confirmation refusait ensuite
la commande, mais cette commande n'aurait jamais du etre acceptee au depart.

### Date de reference dependante du serveur

La partie date de `TL-AAAAMMJJ-XXXXXX` utilisait le fuseau local du serveur.
Render fonctionnant generalement en UTC, une commande passee entre minuit et
1 h au Benin pouvait recevoir la date de la veille.

### Terminaison non atomique

Deux requetes admin simultanees pouvaient toutes deux lire une commande
`confirmed`, la terminer, puis produire deux evenements `order.completed`.
Le statut final restait correct, mais le journal d'activite pouvait contenir un
doublon.

### Collision de reference insuffisamment reprise

L'index MongoDB garantissait l'unicite, mais une collision survenant entre la
verification et l'insertion provoquait une erreur au lieu de generer une
nouvelle reference.

## Modifications realisees

- Fusion des lignes publiques ayant le meme `slug` et le meme `variantId`
  avant la validation et la creation de la commande.
- Verification du stock sur la quantite totale fusionnee.
- Generation de la date de reference avec le fuseau
  `Africa/Porto-Novo`.
- Nouvelle tentative automatique en cas de collision rare sur une reference.
- Conservation de l'idempotence existante sur `clientRequestId`.
- Passage atomique de `confirmed` vers `completed` avec
  `findOneAndUpdate`.
- Garantie d'un seul evenement `order.completed` en cas de requetes
  simultanees.
- Ajout du controle reproductible `npm run check:orders`.

## Scenarios executes

Le controle utilise une base Atlas isolee nommee
`tl_orders_check_<horodatage>`. Il ne modifie pas `lulu_shop` et supprime la
base temporaire dans un bloc `finally`.

| Scenario | Resultat |
| --- | --- |
| Creation d'une commande en attente | Reussi |
| Meme `clientRequestId` envoye deux fois | Une seule commande |
| Format et unicite des references | Reussi, 8 references uniques |
| Date de reference autour de minuit au Benin | Reussi |
| Stock inchange avant confirmation | Reussi |
| Confirmation | Stock retire une seule fois |
| Confirmation repetee | Idempotente |
| Deux confirmations concurrentes pour un stock insuffisant | Une seule reussit |
| Terminaison concurrente | Statut correct, un seul audit |
| Annulation apres confirmation | Stock restaure une seule fois |
| Annulation avant confirmation | Aucun mouvement de stock |
| Annulation d'une commande terminee | Refusee |
| Expiration d'une commande en attente | Reussie, aucun stock modifie |
| Confirmation ou annulation apres expiration | Refusee |
| Stock devenu insuffisant avant confirmation | Confirmation refusee |
| Article hors catalogue ajoute par l'admin | Reussi |
| Deux lignes identiques depassant le stock cumule | Creation refusee |
| Chiffre d'affaires | 20 500 FCFA attendus et obtenus |
| Commandes terminees comptees | 2 attendues et obtenues |
| Articles vendus comptes | 5 attendus et obtenus |
| Base temporaire apres le test | Aucune restante |

## Non-regression

- Build TypeScript backend : reussi.
- Connexion MongoDB Atlas : reussie.
- Controle des commandes : reussi.
- Controles de securite backend : reussis.
- Controles de monitoring backend : reussis.
- Verification TypeScript frontend : reussie.
- ESLint frontend : 0 erreur et 10 avertissements preexistants dans
  `button.tsx`.
- Build Next.js de production : reussi.

## Risques et decisions restantes

- Une commande `pending` ne reserve volontairement pas le stock. Deux clientes
  peuvent donc demander le dernier article ; seule la premiere commande
  confirmee pourra le prendre. Reserver le stock changerait la regle metier et
  n'a pas ete ajoute sans validation.
- Les lignes manuelles sans `unitPrice` restent non chiffrees. Le dashboard les
  signale au lieu d'inventer un revenu.
- Le controle `check:orders` exige un acces Atlas autorise et la permission de
  creer puis supprimer une base temporaire.
- L'envoi reel des e-mails est desactive dans ce controle afin de ne pas
  notifier l'administratrice avec de fausses commandes.

La phase 7 n'a pas ete commencee.
