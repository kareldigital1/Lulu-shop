# Lulu Shop — Migration Next.js + Node.js

Ce dépôt contient désormais deux réalités :

- le site statique historique à la racine, conservé comme référence
- la nouvelle version monorepo inspirée de `GoldFront`

## Structure

```text
lulu_shop/
├── backend-lulu/      # API Express + TypeScript + MongoDB Atlas
├── docs/              # Documentation technique du projet
├── lulu_shop_front/   # Frontend Next.js + TypeScript
├── images/            # Assets historiques du site statique
└── index.html         # Ancienne version statique conservée
```

## Documentation technique

- [Architecture générale](docs/architecture.md)
- [Routes de l'API](docs/api.md)
- [Modèles et collections MongoDB](docs/database.md)
- [Variables d'environnement](docs/environment.md)
- [Déploiement Render + Vercel](docs/deployment.md)
- [Sauvegarde et restauration](docs/backup-restore-procedure.md)
- [Audit de sécurité - Phase 1](docs/security-audit-phase-1.md)
- [Audit des images - Phase 2](docs/image-audit-phase-2.md)
- [Audit du monitoring - Phase 3](docs/monitoring-audit-phase-3.md)
- [Audit des sauvegardes - Phase 4](docs/backup-audit-phase-4.md)
- [Audit SEO - Phase 5](docs/seo-audit-phase-5.md)
- [Audit des commandes - Phase 6](docs/order-audit-phase-6.md)
- [Audit du stock - Phase 7](docs/stock-audit-phase-7.md)
- [Audit du backoffice - Phase 8](docs/backoffice-audit-phase-8.md)
- [Gestion des clientes - Phase 9](docs/customer-audit-phase-9.md)
- [Centre de notifications - Phase 10](docs/notification-center-audit-phase-10.md)
- [Refonte du centre de notifications](docs/notification-center-refactor.md)
- [Audit de performance - Phase 11](docs/performance-audit-phase-11.md)
- [Documentation - Phase 12](docs/documentation-audit-phase-12.md)

## Pourquoi cette architecture

Un site vitrine purement statique n'a pas besoin de MongoDB. Ici, la base n'est justifiée que parce que nous voulons :

- des produits pilotés par API
- un contenu boutique centralisé
- des commandes modifiables avant validation
- des demandes de contact persistées
- une structure extensible comme `GoldFront`

## Démarrage

Le dépôt est un **workspace pnpm** : une seule installation à la racine couvre
les deux applications. pnpm 11+ et Node 22+ sont requis (`corepack enable pnpm`
suffit à obtenir la bonne version).

```bash
# À la racine, une seule fois
cp backend-lulu/.env.example backend-lulu/.env
cp lulu_shop_front/.env.example lulu_shop_front/.env.local
pnpm install
```

Ensuite, tout se lance depuis la racine :

```bash
pnpm dev:back      # API Express
pnpm dev:front     # Next.js
pnpm type-check    # tsc sur les deux projets
pnpm test          # suites Vitest des deux projets
pnpm build         # build backend puis frontend
```

Pour lancer une commande propre à un projet, utilise `--filter` :

```bash
pnpm --filter backend-lulu check:db
pnpm --filter backend-lulu seed
pnpm --filter lulu_shop_front lint
```

### Intégration continue

`.github/workflows/ci.yml` rejoue ces quatre vérifications à chaque poussée sur
`master` ou `dev`, et sur chaque pull request :

```bash
pnpm lint        # ESLint : qualité, React, Next.js et règles d'architecture
pnpm typecheck   # tsc sur le backend puis le frontend
pnpm test        # suites Vitest des deux projets
pnpm build       # build backend puis frontend
```

La CI ne consomme **aucun secret** : le backend ne fait que compiler, et le
frontend retombe sur ses données de repli quand l'API est absente. Elle ne
remplace donc pas les contrôles `check:*`, qui exigent une vraie base MongoDB
et restent à lancer manuellement avant une mise en production.

## Variables d'environnement

### `backend-lulu/.env`

```env
NODE_ENV=development
LOG_LEVEL=info
PORT=8000
MONGO_URI=mongodb+srv://<username>:<password>@<cluster-url>/lulu_shop?retryWrites=true&w=majority
CORS_ORIGIN=http://localhost:3000
FRONTEND_URL=http://localhost:3000
ADMIN_EMAIL=admin@tatalulushop.com
ADMIN_PASSWORD=<mot_de_passe_admin_fort>
JWT_SECRET=<secret_long_et_aleatoire>
GMAIL_USER=tatalulushop@gmail.com
GMAIL_APP_PASSWORD=<mot_de_passe_application_google>
LOW_STOCK_EMAIL=tatalulushop@gmail.com
NEW_PRODUCT_BADGE_DAYS=30
PENDING_ORDER_EXPIRATION_HOURS=72
ORDER_NOTIFICATION_EMAIL=tatalulushop@gmail.com
MAIL_FROM_NAME=Tata Lulu Shop
```

### Alertes de stock par e-mail

Lorsqu'un produit actif passe sous 4 pièces, le backend envoie une alerte à
`LOW_STOCK_EMAIL`. Une seule alerte est envoyée pendant la même période de
stock faible. Le système se réarme quand le stock remonte à 4 pièces ou plus.

Pour Gmail :

1. Active la validation en deux étapes sur le compte `GMAIL_USER`
2. Crée un mot de passe d'application Google pour Tata Lulu Shop
3. Place ce code de 16 caractères dans `GMAIL_APP_PASSWORD`
4. Ne mets jamais le mot de passe normal du compte Gmail dans le projet
5. Lance `pnpm --filter backend-lulu test:email` pour vérifier l'envoi

### Notifications de commande

Chaque nouvelle commande enregistrée en base déclenche un e-mail vers
`ORDER_NOTIFICATION_EMAIL`. Le message contient la référence, les coordonnées
de la cliente, les articles, les couleurs et les quantités. Si Gmail est
temporairement indisponible, la commande reste enregistrée et le backend
retente les notifications non envoyées à son prochain démarrage.

### Expiration des commandes en attente

Une commande qui reste en attente au-delà du nombre d'heures défini dans
`PENDING_ORDER_EXPIRATION_HOURS` passe automatiquement au statut `expired`.
Le contrôle est effectué au démarrage du backend, toutes les 15 minutes et
non lors de chaque lecture du backoffice. Cette transition ne retire ni ne
restaure aucune quantité, car le stock n'est engagé qu'à la confirmation.
Chaque expiration est enregistrée dans le journal d'activité.

### Sauvegardes

Le backoffice contient une page **Sauvegardes** réservée à l'administratrice.
Les deux téléchargements nécessitent le JWT admin :

- `GET /api/admin/backups/json` produit un fichier JSON lisible contenant les
  collections applicatives et les métadonnées GridFS. Les blocs binaires
  `productImages.chunks` sont volontairement exclus de ce format.
- `GET /api/admin/backups/mongodb` produit une archive ZIP complète. Elle
  contient chaque collection en MongoDB Canonical Extended JSON, les
  définitions d'index, les fichiers et les blocs GridFS ainsi qu'un manifeste
  et un guide de restauration.

Après extraction de l'archive MongoDB, valide d'abord son manifeste, ses
collections, ses index et ses blocs GridFS sans écrire dans MongoDB :

```bash
pnpm --filter backend-lulu restore:backup -- "<DOSSIER_EXTRAIT>"
```

Le même outil peut restaurer toutes les collections, recréer les index et
contrôler GridFS dans une **nouvelle base vide**. Il refuse la base source et
toute base cible contenant déjà une collection. La procédure complète se
trouve dans
[docs/backup-restore-procedure.md](docs/backup-restore-procedure.md).

Le JSON lisible est un export de consultation, pas une sauvegarde binaire
restaurable. Chaque export réussi est inscrit dans le journal d'activité. Les
sauvegardes contiennent des coordonnées clientes et doivent donc rester dans
un espace privé et chiffré.

## Journal serveur

Le backend utilise Pino et écrit des logs JSON structurés dans `stdout`. Sur
Render, ils sont visibles dans l'onglet **Logs** du service et peuvent être
transmis plus tard à un service de collecte sans modifier l'application.

`LOG_LEVEL` accepte `fatal`, `error`, `warn`, `info`, `debug`, `trace` ou
`silent`. La valeur recommandée en production est `info`. À ce niveau :

- les démarrages et connexions MongoDB sont enregistrés ;
- les requêtes `POST`, `PUT`, `PATCH` et `DELETE` sont considérées critiques ;
- les exports de sauvegarde sont critiques même en `GET` ;
- les réponses `4xx`, erreurs `5xx`, interruptions et exceptions sont
  enregistrées ;
- les lectures ordinaires réussies restent au niveau `debug` pour éviter le
  bruit.

Chaque requête reçoit un identifiant `X-Request-Id`, renvoyé dans la réponse et
présent dans les logs. Le backend n'enregistre jamais le corps des requêtes,
les cookies ou les en-têtes d'autorisation. Les clés sensibles, URI MongoDB,
mots de passe et jetons sont également masqués par le logger.

Une exception non interceptée ou une promesse rejetée sans gestionnaire est
journalisée au niveau `fatal`, puis le processus s'arrête pour permettre à
Render de le redémarrer dans un état propre.

### `lulu_shop_front/.env.local`

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## MongoDB Atlas

Tu dois créer un cluster Atlas et récupérer l'URI de connexion. Sans ça, le backend ne peut pas fonctionner.

Checklist minimale :

1. Créer un projet Atlas
2. Créer un cluster
3. Créer un utilisateur base de données
4. Autoriser ton IP
5. Copier l'URI dans `backend-lulu/.env`
6. Si ton mot de passe Atlas contient `@`, `:` ou `/`, il faut l'encoder dans l'URI
7. Lancer `pnpm --filter backend-lulu check:db`

## Endpoints actuels

- `GET /api/health`
- `GET /api/ready`
- `GET /api/store/homepage`
- `GET /api/products`
- `GET /api/categories`
- `POST /api/orders`
- `POST /api/contact-requests`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/admin/dashboard` — statistiques commerciales et stock
- `GET /api/admin/products`
- `GET /api/admin/categories`
- `POST /api/admin/products`
- `PATCH /api/admin/products/:id`
- `POST /api/admin/products/:id/restock` — ajout de stock par couleur et taille
- `DELETE /api/admin/products/:id`
- `POST /api/admin/uploads` — envoi d'une image produit, authentification requise
- `DELETE /api/admin/uploads/:id` — suppression d'une image non référencée
- `GET /api/uploads/:id` — lecture publique d'une image produit
- `GET /api/admin/orders` — recherche, statut et pagination
- `PATCH /api/admin/orders/:id`
- `POST /api/admin/orders/:id/confirm`
- `POST /api/admin/orders/:id/cancel`
- `POST /api/admin/orders/:id/complete`
- `POST /api/admin/orders/:id/purchase-order` — génération idempotente du bon PDF
- `GET /api/admin/orders/:id/purchase-order` — téléchargement du bon PDF
- `GET /api/admin/customers` — recherche, tri et pagination des clientes
- `GET /api/admin/customers/:id` — profil et historique des commandes
- `GET /api/admin/notifications` — notifications métier, filtres et compteurs
- `PATCH /api/admin/notifications/:id/read` — marque une alerte comme lue
- `PATCH /api/admin/notifications/:id/unread` — marque une alerte comme non lue
- `POST /api/admin/notifications/read-all` — marque toutes les alertes comme lues
- `POST /api/admin/notifications/unread-all` — marque toutes les alertes comme non lues
- `DELETE /api/admin/notifications/read` — masque les notifications lues
- `GET /api/admin/audit-events` — recherche, action, période et pagination
- `GET /api/admin/stock-movements` — recherche, motif, période et pagination

## Journal d'activité

La collection MongoDB `auditevents` conserve l'historique des connexions et
déconnexions, des créations, modifications, suppressions et masquages de
produits, des changements de prix et de stock, ainsi que du cycle des
commandes. Les entrées sont consultables en lecture seule depuis la rubrique
`Journal d'activité` du backoffice.

Filtres disponibles sur l'API :

- `search`
- `action`
- `dateFrom` et `dateTo` au format `YYYY-MM-DD`
- `page` et `pageSize`

## Historique des mouvements de stock

La collection MongoDB `stockmovements` conserve chaque variation par produit,
couleur et taille avec la quantité avant, la quantité après, la différence, le
motif et, lorsqu'elle existe, la référence de commande. Ces données sont
consultables en lecture seule dans `Historique du stock` dans le backoffice.

Les motifs enregistrés sont :

- `product_created` lors de l'enregistrement initial du stock d'un produit
- `product_deleted` lors de la suppression définitive d'un produit
- `manual_correction` pour une modification depuis la fiche produit
- `order_confirmed` lorsque la confirmation d'une commande retire le stock
- `order_cancelled` lorsque l'annulation restaure le stock
- `restock` lorsqu'un arrivage est ajouté depuis le backoffice

Les mouvements liés aux commandes et les quantités de stock sont enregistrés
dans la même transaction MongoDB afin d'éviter tout historique incomplet.

## Commandes et stock

Le panier crée une commande `pending` avant d'ouvrir WhatsApp. Chaque demande
reçoit une référence `TL-...`, mais aucun stock n'est retiré à cette étape.

Dans le backoffice, l'administrateur peut :

- corriger les quantités et les informations du client
- ajouter un article hors catalogue après l'échange WhatsApp
- convertir cet article en produit masqué pour suivre son stock
- confirmer la commande et retirer le stock dans une transaction MongoDB
- annuler une commande confirmée et restaurer son stock
- terminer une commande confirmée
- télécharger le bon de commande PDF généré après confirmation
- ouvrir WhatsApp avec le message du bon prérempli, sans envoi automatique

Les lignes hors catalogue qui restent manuelles ne modifient aucun stock. Seules
les lignes reliées à un produit, une couleur et une taille du catalogue sont
décomptées.

Le scénario complet peut être rejoué sans toucher aux commandes réelles :

```bash
cd backend-lulu
pnpm --filter backend-lulu check:orders
```

La commande crée une base Atlas temporaire `tl_orders_check_<horodatage>`,
exécute les cas de confirmation, concurrence, annulation, expiration et revenu,
puis supprime cette base.

Le scénario des bons de commande dispose de son propre contrôle isolé :

```bash
cd backend-lulu
pnpm --filter backend-lulu check:purchase-orders
```

Il vérifie la numérotation journalière, la génération automatique, le stockage
GridFS, l'idempotence, la création cliente et le téléchargement du PDF avant de
supprimer la base temporaire `tl_po_check_<horodatage>`.

Le cycle complet du stock peut également être contrôlé sans modifier les
produits réels :

```bash
cd backend-lulu
pnpm --filter backend-lulu check:stock
```

Cette commande utilise une base `tl_stock_check_<horodatage>` et vérifie les
variantes, les tailles, les mouvements, le réapprovisionnement, les commandes,
les suppressions et la courbe du dashboard avant de supprimer la base.

Le bouton `Réapprovisionner` de la gestion des produits permet d'ajouter des
unités à une ou plusieurs combinaisons couleur et taille sans remplacer le
stock existant. Le stock du produit et ses mouvements `restock` sont enregistrés
dans la même transaction MongoDB.

## Tailles et migration

Le stock de chaque produit est désormais suivi par combinaison `couleur +
taille`. Les tailles acceptées sont `XS`, `S`, `M`, `L`, `XL`, `XXL`, `3XL`,
`TU` et `NON_RENSEIGNEE`. Le stock d'une couleur et le stock global du produit
restent présents pour compatibilité, mais ils sont recalculés depuis les tailles.

Les anciens produits, lignes de commande et mouvements de stock sans taille
reçoivent `NON_RENSEIGNEE`. La migration est idempotente et peut être lancée
après sauvegarde avec :

```bash
cd backend-lulu
pnpm --filter backend-lulu migrate:sizes
```

## Cycle de vie des produits

Chaque produit possède désormais un champ `status` :

- `draft` : brouillon visible uniquement dans le backoffice
- `published` : produit affiché dans le catalogue public
- `hidden` : produit retiré temporairement du catalogue
- `archived` : produit conservé en base mais hors du catalogue

Le champ historique `isActive` reste présent pour préserver la compatibilité,
mais il est automatiquement dérivé de `status` et vaut `true` uniquement pour
un produit publié. Les anciennes fiches sans `status` sont migrées
automatiquement : une fiche active devient `published`, une fiche inactive
devient `hidden`.

La gestion des produits permet de filtrer ces quatre états et de modifier
l'état depuis l'éditeur. Une publication est refusée si une couleur ne possède
pas de photo.

## Promotions planifiées

Chaque produit conserve son prix normal numérique dans `priceAmount` et peut
recevoir un `promotionPrice`, un `promotionStartAt` et un `promotionEndAt`.
Les quatre informations doivent être cohérentes : le prix promotionnel doit
être inférieur au prix normal et la fin doit être postérieure au début.

Le backend calcule le prix effectif à chaque lecture. Pendant la période, le
catalogue affiche le prix réduit, l'ancien prix barré et le pourcentage de
remise. Avant le début ou après la fin, le prix normal est automatiquement
rétabli. Le panier, WhatsApp et la commande utilisent le même prix effectif
pour éviter toute divergence.

Les anciens produits sont compatibles : leur montant numérique est extrait une
fois depuis `priceLabel` lorsqu'il est exploitable. Les modifications de
promotion sont enregistrées dans le journal d'activité.

## Badge automatique des nouveaux produits

La première publication renseigne `publishedAt`. Pendant le nombre de jours
défini dans `NEW_PRODUCT_BADGE_DAYS`, l'API renvoie `isNew: true` et
`displayBadge: "Nouveau"`. Le badge disparaît ensuite automatiquement, sans
modification manuelle du produit. La valeur `0` désactive ce badge.

Une republication après masquage ne remet pas le compteur à zéro. Un badge
manuel comme `Best-seller` reste prioritaire pendant toute la période, tandis
que `Nouveau` et `Nouveauté` sont réservés au système. Pour les anciens
produits publiés sans `publishedAt`, la date de création sert de date de
publication initiale.

## Produits populaires

Le classement est calculé automatiquement à partir des commandes `confirmed`
et `completed`. Une commande compte une fois par produit ; la quantité totale
commandée sert à départager les produits ayant le même nombre de commandes.
Les commandes en attente ou annulées et les articles ajoutés manuellement ne
participent pas au classement.

L'API expose le nombre de commandes confirmées, la quantité commandée, le rang
et l'indicateur `isPopular`. Les quatre premiers produits publiés ayant au
moins une commande confirmée sont présentés sur l'accueil. Tant qu'aucune
commande réelle n'est confirmée, l'accueil affiche une sélection neutre sans
présenter artificiellement un produit comme populaire.

## Recherche multicritère

Chaque produit possède une référence stable générée automatiquement sous la
forme `TLS-<slug initial>`. Cette référence est unique dans MongoDB et ne change
pas lors des modifications ultérieures du produit. Les anciennes fiches sans
référence sont complétées automatiquement.

La recherche du catalogue public et celle du backoffice utilisent le même
moteur. Elles couvrent le nom, la catégorie, la grande catégorie, le type, la
couleur et la référence. La recherche ignore les majuscules et les accents ;
plusieurs mots peuvent être combinés, par exemple `crop violet`. Les filtres de
catégorie, de type, de stock et de cycle de vie continuent de s'appliquer en
complément.

## Tableau de bord avancé

Le backoffice charge ses statistiques depuis `GET /api/admin/dashboard`. La
route est réservée à l'administratrice et calcule directement les données dans
MongoDB avec le fuseau `Africa/Porto-Novo`.

Le chiffre d'affaires, les ventes du jour, de la semaine et du mois utilisent
uniquement les commandes `completed`. Une commande `confirmed` n'est donc pas
encore considérée comme du revenu. Les articles sans prix numérique sont
exclus des montants et signalés dans le tableau de bord.

Le tableau de bord présente :

- le chiffre d'affaires total, mensuel, hebdomadaire et quotidien
- les ventes sur 12 mois et sur 8 semaines
- les commandes réparties par statut
- l'évolution reconstruite du stock sur 30 jours
- les produits et grandes catégories les plus vendus
- la valeur de vente estimée du stock selon les prix actuellement applicables
- le nombre de clientes, les nouvelles du mois et le montant moyen dépensé
- les cinq meilleures clientes selon leurs commandes terminées

Les articles manuels sont inclus dans leur catégorie lorsqu'elle est
renseignée, mais ne peuvent pas apparaître dans le classement des produits du
catalogue.

## Centre de notifications

Le backoffice suit les commandes sur tout leur cycle, les variantes sous le
seuil de 4 unités, les ruptures, les nouvelles clientes et le palier de fidélité
de 10 commandes terminées. La cloche et le tableau de bord affichent le nombre
de notifications non lues.

Les erreurs API ne sont jamais affichées dans ce centre métier. Elles restent
dans les logs Pino et le monitoring du backend. La route privée
`/admin/system` explique cette séparation sans exposer de trace ni de secret.

Les notifications lues et résolues datant de plus de
`NOTIFICATION_RETENTION_DAYS` jours sont nettoyées automatiquement. Les
notifications non lues ou encore actives sont conservées.

Les alertes de commande et de stock sont recalculées depuis l'état MongoDB :
une commande confirmée ou un produit réapprovisionné ne reste donc pas
artificiellement critique. Les erreurs stockées sont volontairement limitées à
des métadonnées sûres, sans corps de requête ni secrets.

Le scénario complet est testé dans une base Atlas temporaire :

```bash
cd backend-lulu
pnpm --filter backend-lulu check:notifications
```

Pour diagnostiquer une erreur technique, consulte les logs Pino du service
backend sur Render ; le centre de notifications est volontairement réservé au
suivi commercial.

## Backoffice

Le backoffice est disponible sur :

```text
http://localhost:3000/admin
```

Important :

- ne laisse jamais les valeurs admin par défaut en production
- le produit `Nuisette` est déjà préparé en base
- l'éditeur permet de choisir une image JPG, PNG ou WebP de 5 Mo maximum
- les nouvelles images sont stockées durablement dans MongoDB GridFS (`productImages.files` et `productImages.chunks`)
- le frontend peut se lancer immédiatement grâce à `.env.local`
- le backend utilise le `MONGO_URI` MongoDB Atlas défini dans `backend-lulu/.env`

## Pages d'erreur

Le storefront possède deux états d'erreur cohérents avec l'identité Tata Lulu
Shop :

- la page `404` guide vers le catalogue ou l'accueil lorsqu'une URL ou un
  produit n'existe plus
- la page `500` permet de relancer le rendu après une erreur temporaire sans
  perdre le panier enregistré dans le navigateur

Ces pages sont autonomes et ne chargent pas les données de l'API. Elles restent
donc disponibles même si le backend ou MongoDB est momentanément inaccessible.

## Remarque importante

La nouvelle application n'écrase pas l'ancien site statique. C'est volontaire : une migration propre se fait par comparaison, pas en détruisant la seule version qui fonctionne.
