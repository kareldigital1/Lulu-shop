# Centre de notifications - Phase 10

> Document historique. Le comportement actuel est décrit dans
> `notification-center-refactor.md` : les erreurs techniques ont depuis été
> retirées du centre métier.

Date de l'audit : 31 juillet 2026

## 1. Ce qui existait

Le backend envoyait deja des e-mails pour les nouvelles commandes et le stock
faible. Le backoffice possedait une page limitee aux produits publies ayant de
1 a 3 unites et affichait le nombre de commandes en attente dans le menu.

Ces elements etaient utiles, mais ils ne formaient pas un centre de
notifications : aucun etat lu/non lu, aucune commande expiree, aucune erreur
serveur et aucun compteur unifie n'etaient disponibles.

## 2. Ce qui manquait reellement

- une source persistante et dedupliquee
- quatre types : attente, expiration, stock critique et erreur importante
- une resolution automatique fondee sur l'etat reel
- le marquage individuel et global comme lu
- une API admin protegee
- une cloche et un indicateur dans le tableau de bord
- un ecran unifie, utilisable sur ordinateur et mobile

## 3. Risques identifies

Un simple calcul React aurait perdu l'etat de lecture au rechargement et masque
les erreurs backend. A l'inverse, conserver toutes les alertes sans resolution
aurait laisse des compteurs faux apres confirmation ou reapprovisionnement.

Le centre ne remplace pas les logs. Si MongoDB est indisponible, il est
impossible d'enregistrer la panne dans cette meme base. Les erreurs fatales de
connexion restent donc visibles dans les logs Pino/Render.

La synchronisation relit actuellement les commandes concernees et les produits
critiques lors du chargement du centre. Ce fonctionnement est correct au volume
actuel ; son cout devra etre mesure pendant la phase 11.

## 4. Modifications effectuees

- collection `adminnotifications` avec type, gravite, source, deduplication,
  lecture et resolution
- synchronisation des commandes `pending` et `expired`
- surveillance des produits publies sous 4 unites, stock nul inclus
- enregistrement securise des erreurs HTTP 5xx et des echecs de taches
  automatiques
- routes admin de liste, lecture individuelle et lecture globale
- cloche avec badge dans la barre superieure et entree Notifications du menu
- indicateur compact dans le tableau de bord
- centre filtre par categorie avec liens vers commandes et catalogue
- suppression de l'ancienne page Alertes stock devenue redondante
- script isole `npm run check:notifications`

## 5. Tests realises

- build TypeScript backend : reussi
- test notifications : deduplication, lecture, resolution et erreur reussies
- route sans JWT : refusee avec `401`
- commandes, stock, clientes et securite : non-regressions reussies
- TypeScript frontend et build Next.js : reussis
- ESLint : 0 erreur, 10 avertissements preexistants dans `button.tsx`
- verification Chrome desktop et mobile : aucune erreur console
- verification responsive : aucun debordement horizontal

## 6. Resultats obtenus

Sur les donnees Atlas reelles, le centre affiche 3 notifications coherentes :
2 commandes en attente et 1 produit en stock faible. Il n'existe actuellement
ni commande expiree ni erreur systeme active.

Les donnees reelles n'ont pas ete modifiees pendant la verification visuelle :
aucune notification n'a ete marquee comme lue et aucune commande n'a change de
statut.

## Resultat

La phase 10 est terminee. Le backoffice dispose maintenant d'un centre de
notifications persistant, lisible et fonde sur les donnees reelles. La phase 11
n'a pas ete commencee.
