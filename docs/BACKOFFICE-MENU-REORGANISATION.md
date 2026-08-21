# Réorganisation du backoffice Tata Lulu Shop

Date de vérification : 4 août 2026

## Résultat

Le menu du backoffice est désormais organisé en cinq groupes :

- Gestion : Tableau de bord, Clientes, Commandes et Notifications.
- Catalogue : Produits, Historique du stock et Documents.
- Contenu boutique : Boutique.
- Administration : Journal d'activité et Sauvegardes.
- Actions rapides : Nouveau produit et Voir la boutique.

Les actions rapides sont séparées visuellement du menu principal. L'ancienne entrée
Éditeur a été retirée du menu, mais son formulaire de création et de
modification de produit reste accessible depuis Nouveau produit et depuis les
actions de la liste des produits.

Maintenance système n'est plus visible dans le menu. Sa page privée reste
accessible à l'adresse `/admin/system` après authentification.

## Boutique

La nouvelle vue Boutique modifie le document `Store` existant et centralise :

- identité, slogan, descriptions, logo et favicon ;
- téléphone, WhatsApp, e-mail, adresse, ville et pays ;
- Facebook, Instagram et TikTok ;
- URL Google Maps, URL d'intégration, latitude et longitude ;
- Hero, image et boutons CTA optionnels ;
- histoire, mission, valeurs et présentation de la page À propos ;
- titre SEO, description SEO et image Open Graph ;
- logo, adresse, téléphone, e-mail et texte utilisés dans les PDF.

Les nouveaux champs sont ajoutés au schéma `Store` existant. Aucune collection
MongoDB n'a été créée, supprimée ou renommée. Les anciennes données restent
compatibles grâce à une normalisation de secours côté API et côté frontend.

Les images envoyées pour la boutique sont conservées dans le mécanisme GridFS
déjà utilisé. Le nettoyage des images reconnaît maintenant les références du
document `Store` afin de ne pas supprimer un logo, un favicon ou une image Hero
encore utilisés.

## Documents

La nouvelle vue Documents propose :

- la liste des bons de commande PDF déjà générés ;
- le téléchargement d'un bon de commande ;
- l'accès à la gestion des commandes ;
- l'export JSON ;
- l'export MongoDB ;
- l'accès aux sauvegardes et archives.

Les endpoints de commandes et de sauvegardes existants sont réutilisés. Aucune
collection Documents séparée n'a été ajoutée.

## Maintenance

La page `/admin/system` interroge un nouvel endpoint protégé et affiche :

- l'état de l'API ;
- l'état MongoDB et son temps de réponse ;
- l'état de configuration Gmail ;
- la disponibilité des sauvegardes ;
- l'environnement Node.js et l'uptime.

Aucun secret, mot de passe ou URI MongoDB n'est envoyé au navigateur.

## Nouveaux endpoints

- `GET /api/admin/store` : lecture de la configuration Boutique.
- `PATCH /api/admin/store` : mise à jour validée de la configuration Boutique.
- `GET /api/admin/system/status` : diagnostic privé du système.

Ces trois endpoints utilisent l'authentification administrateur existante.

## Nouveaux composants frontend

- `AdminStoreSettingsPanel`
- `AdminDocumentsPanel`

Le composant `AdminSystemPanel` a été connecté au diagnostic réel du backend.

## Vérifications réalisées

- Build TypeScript backend : réussi.
- TypeScript frontend : réussi.
- ESLint frontend : aucune erreur, dix avertissements préexistants dans
  `Button`.
- Build de production Next.js : réussi.
- Contrôle SEO automatisé : réussi.
- Génération d'un bon de commande PDF : réussie.
- `GET /api/admin/store` avec jeton : HTTP 200.
- `GET /api/admin/system/status` avec jeton : HTTP 200.
- Endpoints privés sans jeton : HTTP 401.
- Routes `/`, `/a-propos`, `/produits`, `/admin` et `/admin/system` : HTTP 200.
- Parcours navigateur desktop : menu, Boutique et Documents validés.
- Parcours navigateur mobile 390 x 844 : ouverture et défilement de la sidebar
  validés.
