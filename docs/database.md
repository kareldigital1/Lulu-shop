# Modèles et collections MongoDB

## Base utilisée

Le backend se connecte à la base indiquée dans `MONGO_URI`. Avec la
configuration recommandée, son nom est `lulu_shop`.

Mongoose transforme automatiquement les noms des modèles en noms de
collections au pluriel et en minuscules.

| Modèle Mongoose | Collection MongoDB | Rôle |
| --- | --- | --- |
| `Category` | `categories` | Grandes catégories proposées dans le catalogue et le backoffice |
| `Product` | `products` | Catalogue, variantes, images, prix et stock |
| `Order` | `orders` | Commandes client et cycle de validation |
| `OrderDocumentSequence` | `orderdocumentsequences` | Compteurs journaliers atomiques des bons de commande |
| `Customer` | `customers` | Profils clientes calculés depuis les commandes |
| `AdminNotification` | `adminnotifications` | Centre d'alertes du backoffice |
| `StockMovement` | `stockmovements` | Historique immuable des variations de stock |
| `AuditEvent` | `auditevents` | Journal des actions sensibles |
| `ContactRequest` | `contactrequests` | Messages envoyés depuis la page contact |
| `Store` | `stores` | Contenu éditorial et coordonnées de la boutique |
| GridFS | `productImages.files` | Métadonnées des images importées |
| GridFS | `productImages.chunks` | Contenu binaire découpé des images |
| GridFS | `orderDocuments.files` | Métadonnées des bons de commande PDF |
| GridFS | `orderDocuments.chunks` | Contenu binaire des bons de commande PDF |

Il n'existe volontairement aucune collection `users` ou `admins`.
L'administratrice unique est authentifiée avec `ADMIN_EMAIL` et
`ADMIN_PASSWORD`, définis dans l'environnement du backend.

## Produit

Les champs métier principaux de `products` sont :

- `slug` et `reference` : identifiants publics uniques ; la référence commence
  par `TLS-`
- `categoryId` : référence obligatoire vers un document de `categories`
- `category`, `types`, `name` : nom de grande catégorie, types précis et identité du produit
- `shortDescription`, `description`, `benefits` : contenu commercial
- `priceLabel`, `priceAmount` : prix normal
- `promotionPrice`, `promotionStartAt`, `promotionEndAt` : promotion planifiée
- `image` : image principale calculée depuis les variantes
- `badge`, `featured`, `order` : mise en avant et ordre d'affichage
- `variants[]` : couleurs, images et stocks détaillés par taille
- `stock` : somme dérivée de tous les stocks couleur et taille
- `availability` : `available` si `stock > 0`, sinon `unavailable`
- `status` : `draft`, `published`, `hidden` ou `archived`
- `isActive`, `publishedAt`, `lowStockAlertSentAt` : publication et alerte
- `createdAt`, `updatedAt` : dates Mongoose

Une variante contient :

```json
{
  "id": "bleu",
  "colorName": "Bleu",
  "colorHex": "#1D4ED8",
  "images": ["/api/uploads/identifiant-gridfs"],
  "sizes": [
    { "size": "M", "stock": 2 },
    { "size": "L", "stock": 2 }
  ],
  "stock": 4
}
```

`variants[].stock` est la somme des tailles de la couleur. Le stock global,
l'image principale, la disponibilité et `isActive` sont resynchronisés avant
chaque sauvegarde. Ils ne doivent pas être corrigés manuellement directement
dans Atlas. Les anciens documents sans `sizes` reçoivent automatiquement une
entrée `NON_RENSEIGNEE` qui reprend leur ancien stock.

### Index produits

- `slug` unique
- `reference` unique
- `status + order + name` pour le catalogue public
- `status + categoryId + order` pour filtrer le catalogue par catégorie
- `order + name` pour la gestion admin
- `isActive + lowStockAlertSentAt + stock` pour les alertes de stock
- `status + stock + name` pour les alertes actives du backoffice

## Catégorie

La collection `categories` est la source de vérité du classement des produits.
Chaque document contient `name`, `slug`, `order`, `defaultTypes` et `isActive`.
Les catégories initiales sont `Robes`, `Hauts`, `Bas`, `Combinaisons`,
`Lingerie & Nuit` et `Accessoires`.

Le backend initialise ces documents de manière idempotente et migre les
anciennes catégories précises vers `types`. Par exemple, un ancien produit
classé `Crop top` devient un produit de la catégorie `Hauts` avec le type
`Crop top`. Une catégorie ne doit donc plus être saisie librement lors de la
création d'un produit : le backoffice envoie son identifiant MongoDB.

## Commande

Une commande contient une référence unique de forme `TL-AAAAMMJJ-XXXXXX`, un
`clientRequestId` UUID anti-doublon, les coordonnées du client, une note, les
lignes commandées et son statut. Le champ `customerId` relie automatiquement
la commande au profil de la cliente identifié par son numéro normalisé.

Les statuts autorisés sont :

| Statut | Effet |
| --- | --- |
| `pending` | Commande créée, stock non modifié |
| `confirmed` | Commande validée par l'admin, stock déduit |
| `cancelled` | Commande annulée ; stock restauré s'il avait été déduit |
| `completed` | Vente terminée, comptabilisée dans le chiffre d'affaires |
| `expired` | Commande en attente expirée, aucun stock à restaurer |

Une ligne peut provenir du `catalog` ou être ajoutée manuellement par
l'administratrice. Les lignes manuelles permettent de représenter les articles
convenus sur WhatsApp mais absents du catalogue. Chaque ligne conserve `colorName`
et `size`; une ligne catalogue conserve aussi `productId` et `variantId` afin de
viser exactement le stock couleur et taille lors de la confirmation.

Les champs `inventoryAppliedAt` et `inventoryRestoredAt` rendent les opérations
de stock idempotentes. Les dates `notificationEmailRequestedAt`,
`notificationEmailClaimedAt` et `notificationEmailSentAt` suivent l'envoi du
mail de nouvelle commande.

Après confirmation, `purchaseOrder` associe le bon de commande à la commande :

- `number` : numéro unique `BC-AAAAMMJJ-XXXX`
- `fileId` : identifiant du PDF dans le bucket GridFS `orderDocuments`
- `fileName` : nom proposé au téléchargement
- `generatedAt` : date de génération

La collection `orderdocumentsequences` attribue les suffixes journaliers avec
une opération MongoDB atomique. Une séquence consommée n'est jamais réutilisée,
même si une génération échoue : un éventuel trou est préférable à un doublon.
Le PDF est un instantané de la commande confirmée et n'est pas régénéré si le
fichier associé existe déjà.

### Index commandes

- `reference` unique
- `clientRequestId` unique
- `createdAt`
- `status + createdAt`
- `status + expiredAt` pour les notifications d'expiration
- `status + items.productId`
- `customerId + createdAt`
- `purchaseOrder.number` unique lorsqu'un bon existe

## Cliente

La collection `customers` est construite et tenue à jour depuis les commandes.
Elle ne représente pas un compte utilisateur et ne contient aucun mot de passe.
Le numéro de téléphone normalisé sert d'identité technique ; le nom seul n'est
pas assez fiable pour distinguer deux clientes.

Les champs métier principaux sont :

- `customerCode` : identifiant public stable au format `TLS-C-XXXXXXXXXXXX`
- `name`, `phone` et `normalizedPhone`
- `orderCount` : toutes les commandes, quel que soit leur statut
- `completedOrderCount` : uniquement les commandes terminées
- `totalSpent` : somme des commandes `completed`
- `lastOrderId`, `lastOrderReference` et `lastOrderAt`
- `createdAt` : date de la première commande
- `updatedAt` : dernière synchronisation

La synchronisation relie aussi les anciennes commandes avec `customerId`. Un
changement de téléphone sur une commande réaffecte celle-ci au bon profil.
Elle est exécutée au démarrage et après les mutations de commandes, jamais
avant une simple lecture. Cette réconciliation relit encore toutes les
commandes : elle est fiable au volume actuel, mais devra devenir incrémentale
avant une forte croissance.

### Index clientes

- `customerCode` unique pour retrouver une cliente sans exposer son téléphone
- `normalizedPhone` unique
- `name`
- `lastOrderAt`
- `totalSpent + lastOrderAt`
- `orderCount + lastOrderAt`
- `lastOrderAt + name` (`customer_recent`)

## Notification administrateur

La collection `adminnotifications` centralise neuf types métier : cinq états
de commande, le stock faible, la rupture, les événements clientes et les
informations système compréhensibles. Elle ne stocke plus les erreurs API.

Chaque notification contient `type`, `title`, `message`, `resourceType`,
`resourceId`, `isRead`, `createdAt` et éventuellement `readAt`. Les champs
`severity`, `details`, `resolvedAt`, `deletedAt` et `dedupeKey` assurent la
présentation, les liens métier, la déduplication et la conservation de
l'historique.

Les situations qui ne sont plus actives reçoivent `resolvedAt` mais restent
consultables. Une suppression globale renseigne `deletedAt` afin d'éviter la
réapparition immédiate d'une alerte encore active. Chaque jour, le backend
supprime physiquement les notifications lues et résolues plus anciennes que
`NOTIFICATION_RETENTION_DAYS`. Les notifications importantes, non lues ou
encore actives sont conservées.

Les erreurs HTTP, les traces et les échecs des tâches automatiques restent dans
Pino, les logs de l'hébergeur et le monitoring.

### Index notifications

- `dedupeKey` unique
- `deletedAt + isRead + createdAt`
- `type + deletedAt + resolvedAt + createdAt`
- `resourceType + resourceId + createdAt`

## Mouvement de stock

`stockmovements` constitue la trace de chaque variation. Un enregistrement
indique le produit, la variante, la quantité avant et après, la différence,
l'acteur et éventuellement la commande liée.

Raisons autorisées :

- `product_created`
- `product_deleted`
- `order_confirmed`
- `order_cancelled`
- `manual_correction`
- `restock`

Cette collection est un journal : on ajoute un mouvement, on ne réécrit pas
l'historique pour le faire correspondre au stock actuel.

## Événement d'audit

`auditevents` enregistre les connexions, déconnexions, exports, changements de
produits et transitions de commandes. Chaque événement possède une `action`,
un `actor`, une ressource, un résumé et des détails structurés.

Les acteurs possibles sont `admin`, `customer` et `system`. Les ressources
sont `auth`, `backup`, `product` et `order`.

## Demande de contact

`contactrequests` stocke `name`, `email`, `phone`, `message` et un statut
`new` ou `processed`, avec les dates de création et de modification.

## Boutique

`stores` centralise le contenu de la vitrine :

- identité et métadonnées SEO
- hero et statistiques
- histoire, valeurs et bénéfices
- témoignages et FAQ
- adresse, horaires, coordonnées GPS et liens Google Maps
- téléphones, WhatsApp, TikTok, contact et footer
- catégories affichées

Le document principal est retrouvé par son `slug` unique.

## Images GridFS

Les fichiers JPG, PNG et WebP de 5 Mo maximum sont stockés dans le bucket
GridFS `productImages`. Ne supprime pas seulement un document de
`productImages.files` : les blocs associés resteraient dans
`productImages.chunks`.

L'API publique `/api/uploads/:id` est la seule URL à enregistrer dans une
variante. Une image n'est donc pas dépendante du disque éphémère de Render.

## Sauvegardes

Le backoffice propose deux exports :

- JSON : données applicatives lisibles, sans les blocs binaires `.chunks`
- MongoDB : archive complète incluant documents, index et fichiers GridFS

Un export téléchargé n'est pas une sauvegarde tant qu'il reste uniquement dans
le navigateur. Il doit être conservé dans un emplacement distinct et protégé.
