# Refonte du centre de notifications

Date : 4 août 2026

## Objectif

Le centre du backoffice est désormais réservé au suivi métier de Tata Lulu
Shop. Les erreurs techniques ont été retirées de MongoDB et restent dans Pino,
les logs serveur et le monitoring.

## Fonctionnalités

- neuf types pour les commandes, le stock, les clientes et le système métier ;
- états lu et non lu individuels ou globaux ;
- filtres Toutes, Non lues, Lues, Commandes, Stock, Clientes et Système ;
- ouverture contextuelle de la commande, du produit ou de la cliente ;
- suppression logique des notifications lues ;
- nettoyage quotidien configurable, sans supprimer les alertes importantes ;
- widget synthétique dès l'ouverture du tableau de bord ;
- page privée `/admin/system` séparée du centre commercial.

## Compatibilité

La collection `adminnotifications` est conservée. Au démarrage, les anciens
documents sont convertis vers `resourceType`, `resourceId` et `isRead`. Les
anciens documents `system_error` sont supprimés.

## Vérification

`npm run check:notifications` crée une base Atlas temporaire, vérifie la
création automatique, les neuf types, les sept filtres, les compteurs, la
lecture, la non-lecture, la suppression, les clientes fidèles, le stock par
couleur et la rétention, puis supprime cette base.
