# Audit du stock - Phase 7

Date : 31 juillet 2026

## Perimetre

- Variantes et quantites par couleur
- Calcul du stock global
- Disponibilite
- Creation et modification des produits
- Reapprovisionnement
- Confirmation, annulation et expiration des commandes
- Suppression des couleurs et des produits
- Historique des mouvements
- Courbe de stock du dashboard
- Coherence des donnees Atlas existantes

## Etat trouve

### Deja en place

- Chaque couleur possede son propre stock.
- Le stock global est calcule a partir de la somme des variantes.
- La disponibilite vaut `available` lorsque le total est positif et
  `unavailable` lorsqu'il est nul.
- Les quantites negatives sont refusees par Zod et Mongoose.
- La modification manuelle d'une quantite cree un mouvement
  `manual_correction`.
- Le reapprovisionnement ajoute les quantites sans remplacer le stock existant.
- Le produit, ses variantes et les mouvements de reapprovisionnement sont
  enregistres dans une meme transaction MongoDB.
- La confirmation d'une commande retire le stock dans une transaction.
- L'annulation d'une commande confirmee restaure le stock une seule fois.
- Une commande en attente ou expiree ne modifie pas le stock.
- L'historique est protege par authentification admin, filtre par motif et
  periode, recherche et pagination.
- Le dashboard reconstruit les 30 derniers jours a partir des differences des
  mouvements.
- Les alertes de stock faible sont reinitialisees apres un
  reapprovisionnement suffisant.

## Anomalies confirmees

### Stocks initiaux et suppressions absents de l'historique

La creation d'un produit deja stocke et la suppression d'un produit encore
stocke modifiaient le total sans produire de mouvement. La courbe historique
ne pouvait donc pas expliquer le stock courant.

### Restauration rendue impossible

Une couleur ou un produit pouvait etre supprime pendant qu'une commande
confirmee y faisait encore reference. Une annulation ulterieure ne retrouvait
alors plus la variante et ne pouvait pas restaurer le stock.

### Plafond contournable par le reapprovisionnement

La creation et l'edition limitaient une couleur a 1 000 000 d'unites, mais un
reapprovisionnement pouvait depasser cette limite.

### Stock fantome sans variante

Un brouillon sans aucune couleur pouvait conserver un stock global positif.
Ces unites apparaissaient dans le dashboard alors qu'aucune variante ne
permettait de les gerer ou de les commander. Retirer la derniere variante d'un
brouillon produisait la meme incoherence.

## Modifications realisees

- Creation des mouvements `product_created` pour chaque stock initial positif.
- Creation des mouvements `product_deleted` pour chaque stock retire lors
  d'une suppression.
- Creation et suppression du produit rendues transactionnelles avec leurs
  mouvements.
- Ajout des libelles **Stock initial** et **Produit supprime** dans
  l'historique du backoffice.
- Blocage de la suppression d'une couleur referencee par une commande
  `confirmed`.
- Blocage de la suppression d'un produit reference par une commande
  `confirmed`.
- Suppression de nouveau autorisee apres annulation ou terminaison de la
  commande.
- Centralisation de la limite `MAX_VARIANT_STOCK` a 1 000 000 et de la limite
  globale a 30 000 000.
- Application du plafond dans Zod, Mongoose et le service de
  reapprovisionnement.
- Regle canonique : aucune variante signifie toujours un stock nul et une
  disponibilite `unavailable`.
- Ajout de la commande reproductible `npm run check:stock`.

## Controle des donnees Atlas reelles

Le controle a ete effectue en lecture seule.

| Controle | Resultat |
| --- | --- |
| Produits inspectes | 11 |
| Commandes inspectees | 2, toutes en attente |
| Mouvements existants | 2 |
| Ecart entre somme des variantes et stock global | 0 |
| Disponibilite incoherente | 0 |
| Variante negative, fractionnaire ou dupliquee | 0 |
| Erreur `apres - avant != difference` | 0 |
| Rupture entre les mouvements existants | 0 |
| Mouvement inattendu sur une commande en attente | 0 |

## Scenarios automatises

`npm run check:stock` utilise une base Atlas isolee
`tl_stock_check_<horodatage>` puis la supprime dans un bloc `finally`.

| Scenario | Resultat |
| --- | --- |
| Stock global derive de deux variantes | 7 unites attendues et obtenues |
| Valeur globale falsifiee dans la requete | Ignoree au profit des variantes |
| Mouvements de stock initial | 2 mouvements |
| Correction manuelle sur deux couleurs | Historisee et total coherent |
| Reapprovisionnement de deux couleurs | 10 unites attendues et obtenues |
| Reapprovisionnement avec une couleur inexistante | Transaction entierement annulee |
| Depassement de 1 000 000 sur une couleur | Refuse sans stock partiel |
| Commande en attente | Aucun retrait |
| Confirmation | Retrait et mouvement verifies |
| Suppression de couleur pendant confirmation | Refusee |
| Suppression du produit pendant confirmation | Refusee |
| Annulation | Restauration et mouvement verifies |
| Expiration | Aucun mouvement |
| Suppression apres annulation | Autorisee et stock sorti de l'historique |
| Brouillon sans couleur | Stock force a zero |
| Retrait de la derniere couleur d'un brouillon | Stock force a zero |
| Continuite avant/apres par variante | Verifiee sur 10 mouvements |
| Somme des differences apres suppression | Zero, comme le stock courant |
| Courbe du dashboard | 7, puis 10, puis 0 |
| Base temporaire apres les tests | Aucune restante |

## Non-regression

- Build TypeScript backend : reussi.
- Controle du stock : reussi.
- Controle des commandes : reussi.
- Connexion MongoDB Atlas : reussie.
- Controles de securite backend : reussis.
- Controles de monitoring backend : reussis.
- Verification TypeScript frontend : reussie.
- ESLint frontend : 0 erreur et 10 avertissements preexistants dans
  `button.tsx`.
- Build Next.js de production avec le backend local disponible : reussi.

## Risques et decisions restantes

- Les anciens stocks initiaux n'avaient pas de mouvements. Ils ne peuvent pas
  etre reconstruits fidelement apres coup sans inventer des dates et des
  quantites. Aucun faux historique n'a donc ete insere. Les nouvelles
  operations seront completes a partir de cette version.
- Une modification directe dans MongoDB Atlas contourne Zod et les services.
  Les changements de stock doivent passer par le backoffice.
- Une commande `pending` ne reserve pas le stock. Cette decision metier est
  conservee : seule la premiere confirmation valide peut prendre les dernieres
  unites.
- Un produit lie uniquement a des commandes terminees peut encore etre
  supprime, car ces commandes ne peuvent plus etre annulees et conservent leur
  propre photographie des articles.

La phase 8 n'a pas ete commencee.
