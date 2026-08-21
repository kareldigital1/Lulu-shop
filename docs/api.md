# API Tata Lulu Shop

## Conventions

En local, l'URL de base est `http://localhost:8000`. Toutes les routes métier
commencent par `/api`.

- Les corps ordinaires utilisent `Content-Type: application/json`.
- Les routes admin utilisent `Authorization: Bearer <token>`.
- Les erreurs JSON suivent la forme `{ "message": "..." }`.
- Chaque réponse possède un en-tête `X-Request-Id` exploitable dans les logs.
- Les identifiants `:id` sont des identifiants MongoDB sauf indication
  contraire.

## Routes publiques

| Méthode | Route | Réponse | Description |
| --- | --- | --- | --- |
| `GET` | `/api/health` | `200` | État du backend |
| `GET` | `/api/ready` | `200`, `503` | État de la connexion MongoDB |
| `GET` | `/api/store/homepage` | `200` | Contenu éditorial de la boutique |
| `GET` | `/api/categories` | `200` | Catégories actives, dans l'ordre d'affichage |
| `GET` | `/api/products` | `200` | Produits au statut `published` |
| `GET` | `/api/uploads/:id` | `200`, `304` | Image GridFS publique |
| `POST` | `/api/contact-requests` | `201` | Enregistre un message de contact |
| `POST` | `/api/orders` | `201` | Crée une commande en attente |

Le catalogue public est paginé côté interface afin de conserver des filtres
instantanés. La route `/api/products` retourne actuellement la liste publiée
complète.

### Demande de contact

```json
{
  "name": "Afi",
  "email": "afi@example.com",
  "phone": "+229 01 00 00 00 00",
  "message": "Je voudrais connaître les couleurs disponibles."
}
```

`name` contient au moins 2 caractères, `message` au moins 10 et `email` doit
être valide.

### Création d'une commande

```json
{
  "clientRequestId": "c2925c9d-c5f1-4ec4-89c2-c729707777d8",
  "customerName": "Afi",
  "customerPhone": "+229 01 00 00 00 00",
  "note": "Je passerai samedi matin.",
  "items": [
    {
      "slug": "crop-top-audace",
      "variantId": "bleu",
      "size": "M",
      "quantity": 1
    }
  ]
}
```

`clientRequestId` est un UUID d'idempotence : renvoyer la même demande ne doit
pas créer deux commandes. Une commande accepte 1 à 30 lignes et chaque
quantité publique est comprise entre 1 et 50.

## Authentification

| Méthode | Route | Authentification | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/login` | Non | Retourne le JWT admin |
| `POST` | `/api/auth/logout` | Oui | Journalise la déconnexion, réponse `204` |

```json
{
  "email": "adresse-configuree-dans-admin-email",
  "password": "mot-de-passe-configure"
}
```

Réponse :

```json
{
  "token": "<jwt-valable-12-heures>",
  "admin": {
    "email": "adresse-configuree-dans-admin-email",
    "role": "admin"
  }
}
```

## Routes administrateur

Toutes les routes suivantes exigent le JWT.

### Tableau de bord et sauvegardes

| Méthode | Route | Description |
| --- | --- | --- |
| `GET` | `/api/admin/dashboard` | Revenus, ventes, commandes, stock et clientes |
| `GET` | `/api/admin/backups/json` | Sauvegarde JSON sans blocs GridFS |
| `GET` | `/api/admin/backups/mongodb` | Archive ZIP EJSON complète avec index et GridFS |

Seules les commandes `completed` alimentent le chiffre d'affaires.

### Produits

| Méthode | Route | Réponse | Description |
| --- | --- | --- | --- |
| `GET` | `/api/admin/categories` | `200` | Toutes les catégories proposées dans l'éditeur |
| `GET` | `/api/admin/products` | `200` | Tous les statuts produit |
| `POST` | `/api/admin/products` | `201` | Crée un produit |
| `PATCH` | `/api/admin/products/:id` | `200` | Modifie les champs transmis |
| `POST` | `/api/admin/products/:id/restock` | `200` | Ajoute du stock par couleur et taille |
| `DELETE` | `/api/admin/products/:id` | `200` | Suppression définitive |

Corps minimal illustratif d'un produit publiable :

```json
{
  "slug": "robe-exemple",
  "categoryId": "000000000000000000000000",
  "category": "Robes",
  "types": ["Robe de soirée"],
  "name": "Robe Exemple",
  "shortDescription": "Une robe élégante et facile à porter.",
  "description": "Description détaillée de la robe et de sa coupe.",
  "benefits": ["Coupe élégante"],
  "priceLabel": "À partir de 5 000 FCFA",
  "priceAmount": 5000,
  "promotionPrice": null,
  "promotionStartAt": null,
  "promotionEndAt": null,
  "image": "/api/uploads/000000000000000000000000",
  "badge": "",
  "whatsappMessage": "Je souhaite commander la Robe Exemple.",
  "featured": false,
  "order": 20,
  "variants": [
    {
      "id": "rouge",
      "colorName": "Rouge",
      "colorHex": "#FF0000",
      "images": ["/api/uploads/000000000000000000000000"],
      "sizes": [
        { "size": "M", "stock": 2 },
        { "size": "L", "stock": 2 }
      ],
      "stock": 4
    }
  ],
  "stock": 4,
  "status": "published",
  "isActive": true
}
```

Pour publier, chaque couleur doit posséder au moins une photo et une taille. Le
backend recalcule le stock couleur, `stock`, `availability`, `image` et
`isActive`.

Réapprovisionnement :

```json
{
  "items": [
    {
      "variantId": "rouge",
      "size": "M",
      "quantity": 5
    }
  ],
  "note": "Arrivage du 30 juillet"
}
```

### Images

| Méthode | Route | Description |
| --- | --- | --- |
| `POST` | `/api/admin/uploads` | Envoi `multipart/form-data`, champ `image` |
| `DELETE` | `/api/admin/uploads/:id` | Supprime une image GridFS non référencée |

Un seul fichier JPG, PNG ou WebP de 5 Mo maximum est accepté. La réponse
`201` contient `{ "image": "/api/uploads/:id" }`.

### Commandes

| Méthode | Route | Description |
| --- | --- | --- |
| `GET` | `/api/admin/orders` | Recherche, filtre et pagine les commandes |
| `PATCH` | `/api/admin/orders/:id` | Modifie cliente, note ou lignes |
| `POST` | `/api/admin/orders/:id/confirm` | Engage le stock |
| `POST` | `/api/admin/orders/:id/cancel` | Annule et restaure le stock engagé |
| `POST` | `/api/admin/orders/:id/complete` | Finalise une commande confirmée |
| `POST` | `/api/admin/orders/:id/purchase-order` | Génère le bon s'il n'existe pas encore |
| `GET` | `/api/admin/orders/:id/purchase-order` | Télécharge le PDF associé |

Une ligne modifiée par l'admin peut être liée au catalogue (`source:
"catalog"`) ou manuelle (`source: "manual"`). Une ligne catalogue doit cibler
une combinaison `variantId + size`. Les transitions invalides retournent une
erreur `409`.

La confirmation tente automatiquement de générer le bon de commande. Une
défaillance PDF ne remet pas en cause la confirmation ni la transaction de
stock : l'administratrice peut relancer ensuite la route de génération. Seules
les commandes `confirmed` ou `completed` peuvent recevoir un nouveau bon.
L'appel `POST` est idempotent lorsque le fichier GridFS existe déjà.

Le document est intitulé `BON DE COMMANDE` et ne constitue pas une facture.
Les prix absents sont affichés `À confirmer`; dans ce cas le PDF n'affiche pas
un faux montant total partiel.

La liste accepte `search`, `status`, `page` et `pageSize`. `status` accepte
`pending`, `confirmed`, `cancelled`, `completed` ou `expired`. La taille par
défaut est 8 et la taille maximale 100. La réponse suit cette forme :

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "pageSize": 8,
  "totalPages": 1
}
```

### Clientes

| Méthode | Route | Description |
| --- | --- | --- |
| `GET` | `/api/admin/customers` | Recherche, trie et pagine les clientes |
| `GET` | `/api/admin/customers/:id` | Profil et historique des commandes |

La liste accepte `search`, `sort`, `page` et `pageSize`. Les tris disponibles
sont `recent`, `spent-desc`, `orders-desc` et `name-asc`. Le total dépensé
additionne uniquement les commandes `completed`; le nombre de commandes
conserve tous les statuts pour ne pas masquer les annulations ou demandes en
attente.

Les profils sont dérivés automatiquement des commandes et identifiés par leur
numéro normalisé. Chaque profil expose aussi un `customerCode` stable et
recherchable. L'historique renvoyé par `GET /api/admin/customers/:id` contient
les références réelles des commandes afin que le backoffice puisse les ouvrir
dans la gestion des commandes. Cette API ne crée aucun compte cliente et
n'expose aucune route publique de connexion.

Le bloc `customers` de `GET /api/admin/dashboard` contient le total des
clientes, les nouvelles clientes du mois courant, le montant moyen dépensé par
cliente et les cinq meilleures clientes classées par montant dépensé. La
moyenne est calculée sur toutes les clientes, y compris celles dont aucune
commande n'est encore terminée.

### Notifications

| Méthode | Route | Description |
| --- | --- | --- |
| `GET` | `/api/admin/notifications` | Liste les notifications métier |
| `PATCH` | `/api/admin/notifications/:id/read` | Marque une notification comme lue |
| `PATCH` | `/api/admin/notifications/:id/unread` | Marque une notification comme non lue |
| `POST` | `/api/admin/notifications/read-all` | Marque toutes les notifications comme lues |
| `POST` | `/api/admin/notifications/unread-all` | Marque toutes les notifications comme non lues |
| `DELETE` | `/api/admin/notifications/read` | Masque toutes les notifications lues |

La liste accepte `filter`, `type` et `limit` (1 à 200, défaut 100). Les filtres
autorisés sont `all`, `unread`, `read`, `orders`, `stock`, `customers` et
`system`. La réponse contient `items` et `summary`, avec les compteurs totaux,
lus, non lus, par type et le résumé du tableau de bord.

Les types métier sont `order_pending`, `order_confirmed`, `order_cancelled`,
`order_completed`, `order_expired`, `low_stock`, `out_of_stock`,
`new_customer` et `system`.

La synchronisation déduit les commandes et stocks depuis leurs collections
source. Elle est exécutée au démarrage et après une mutation pertinente, puis
résout les alertes qui ne correspondent plus à l'état réel. Le `GET` ne
réécrit pas les collections avant de répondre. Les erreurs techniques restent
exclusivement dans Pino, les logs serveur et le monitoring.

### Journal d'activité

`GET /api/admin/audit-events`

| Paramètre | Type | Défaut | Description |
| --- | --- | --- | --- |
| `search` | texte | vide | Libellé, identifiant ou résumé |
| `action` | enum | vide | Action d'audit |
| `dateFrom` | `AAAA-MM-JJ` | vide | Début inclus |
| `dateTo` | `AAAA-MM-JJ` | vide | Fin incluse |
| `page` | entier positif | `1` | Page |
| `pageSize` | 1 à 100 | `20` | Taille de page |

La réponse contient `items`, `total`, `page`, `pageSize` et `totalPages`.

### Historique du stock

`GET /api/admin/stock-movements`

Les paramètres sont `search`, `reason`, `dateFrom`, `dateTo`, `page` et
`pageSize`. Les raisons admises sont :

- `product_created`
- `product_deleted`
- `order_confirmed`
- `order_cancelled`
- `manual_correction`
- `restock`

Le format paginé est identique à celui du journal d'activité.

## Codes d'erreur principaux

| Code | Signification |
| --- | --- |
| `400` | Corps, filtre ou fichier invalide, notamment une image de plus de 5 Mo |
| `401` | JWT absent, invalide ou expiré |
| `403` | Jeton valide mais sans rôle admin attendu |
| `404` | Produit, commande ou image introuvable |
| `409` | Conflit métier : stock, doublon ou transition impossible |
| `413` | Corps JSON de plus de 100 Ko |
| `415` | Format d'image non accepté |
| `429` | Limite de tentatives atteinte |
| `500` | Erreur interne |
| `503` | Base de données temporairement indisponible |
