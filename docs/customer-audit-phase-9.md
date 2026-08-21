# Gestion des clientes - Phase 9

Date de l'audit : 31 juillet 2026

## 1. Ce qui existait

Les commandes conservaient deja `customerName` et `customerPhone`, mais il
n'existait ni collection `customers`, ni relation entre les commandes d'une
meme cliente, ni ecran dedie dans le backoffice.

## 2. Ce qui manquait reellement

- un profil cliente persistant et dedoublonne
- une association automatique entre commandes et cliente
- des indicateurs fiables : nombre de commandes, ventes terminees et total
  depense
- la recherche, le tri, la pagination et l'historique d'achat
- une rubrique Clientes protegee dans le backoffice

Un compte cliente avec mot de passe n'etait pas necessaire et n'a pas ete
ajoute.

## 3. Decisions metier

Le nom n'est pas un identifiant fiable. L'association utilise donc le telephone
normalise. Les anciens formats beninois a 8 chiffres, les numeros commencant par
`01` et les numeros avec indicatif `229` convergent vers la meme identite.

`orderCount` compte toutes les commandes pour conserver la realite du parcours.
`completedOrderCount` et `totalSpent` utilisent uniquement les commandes
`completed`, conformement a la definition du chiffre d'affaires du projet.

Les demandes de contact ne creent pas de cliente : elles peuvent ne contenir
aucun telephone et ne constituent pas un achat.

## 4. Changements implementes

- modele MongoDB `Customer` et index de recherche/tri
- champ `customerId` sur chaque commande
- synchronisation et reconciliation automatiques des commandes existantes
- synchronisation apres creation, modification, confirmation, annulation,
  finalisation et expiration d'une commande
- routes admin `GET /api/admin/customers` et
  `GET /api/admin/customers/:id`
- page Clientes dans le backoffice avec recherche, tri, pagination, fiche,
  lien WhatsApp et historique
- script isole `npm run check:customers`

## 5. Verifications

- build backend et build frontend : reussis
- TypeScript frontend : reussi
- lint frontend : 0 erreur, 10 avertissements preexistants dans `button.tsx`
- securite : route clientes sans JWT refusee avec `401`
- tests commandes, stock et securite : reussis
- test clientes : normalisation, concurrence, liaison, changement de numero,
  recherche, tri, pagination et historique reussis
- verification desktop et mobile : aucune barre de defilement horizontale
- MongoDB Atlas reel : 2 profils reconstruits depuis 2 commandes existantes

Les deux commandes reelles etant encore `pending`, le total depense obtenu est
logiquement de 0 FCFA. Le gonfler avec des commandes non terminees aurait donne
un indicateur commercial faux.

## 6. Risques restants

La reconciliation relit actuellement toutes les commandes lors d'une
synchronisation. C'est robuste au volume actuel, mais ce choix doit etre mesure
et optimise si le catalogue de commandes grossit fortement. Ce point releve de
la phase de performance, pas d'une optimisation prematuree.

Les profils clientes sont des donnees derivees. Une modification manuelle
directe dans Atlas sera ecrasee par la prochaine synchronisation ; les
coordonnees doivent etre corrigees depuis la commande source.

## Resultat

La phase 9 est terminee. La gestion des clientes est operationnelle sans
introduire de comptes clientes inutiles. La phase 10 n'a pas ete commencee.

## Extension production du 4 aout 2026

La gestion des clientes a ete completee sans modifier le cycle de vie des
commandes :

- ajout d'un `customerCode` stable, unique et recherchable ;
- recherche par code cliente dans le backoffice ;
- ouverture d'une commande reelle depuis l'historique de la cliente ;
- statistiques clientes dans le tableau de bord : total, nouvelles du mois,
  montant moyen et classement des cinq meilleures clientes ;
- adaptation du controle `check:customers` au modele de categories actuel.

L'adresse e-mail n'a volontairement pas ete ajoutee au profil : aucune etape du
workflow de commande ne collecte cette donnee. Stocker un champ toujours vide
donnerait l'illusion d'une fonctionnalite qui n'existe pas encore.

Le build backend, le type-check frontend et le lint passent. Le controle Atlas
doit etre relance apres autorisation de l'adresse IP courante dans Network
Access ; la connexion est actuellement refusee avant l'execution du scenario.
