# Audit de performance — phase 11

Date : 31 juillet 2026

## Périmètre

Cette phase vérifie les requêtes MongoDB, les index, la pagination, les appels API du backoffice, les temps de réponse du frontend et les régressions métier. Les mesures ont été réalisées contre le cluster Atlas du projet, avec 11 produits, 2 commandes, 2 clientes et 3 notifications.

## Diagnostic confirmé

- La latence minimale Atlas observée est d'environ 110 à 140 ms par aller-retour. Le problème principal n'était donc pas la quantité actuelle de documents, mais la multiplication des requêtes.
- `GET /api/admin/customers` reconstruisait tous les profils clientes avant chaque lecture.
- `GET /api/admin/notifications` rescannait commandes et produits puis réécrivait les notifications avant chaque lecture.
- `GET /api/admin/orders` exécutait le contrôle d'expiration et renvoyait tout l'historique sans pagination.
- La connexion au backoffice téléchargeait immédiatement statistiques, notifications, produits et commandes, même quand seul le tableau de bord était visible.
- Le tri récent des clientes faisait un `COLLSCAN + SORT`, faute d'index composé adapté.

## Corrections appliquées

- Les lectures clientes et notifications sont maintenant de vraies lectures sans synchronisation complète préalable.
- Les synchronisations restent exécutées au démarrage et après les mutations de commandes ou de produits.
- La file de synchronisation des notifications rejoue une passe si une mutation arrive pendant une synchronisation en cours.
- Les commandes disposent d'une pagination serveur, d'un filtre de statut et d'une recherche validée côté API.
- Le contrôle d'expiration reste exécuté au démarrage et toutes les 15 minutes, au lieu de ralentir chaque consultation de la liste.
- Le backoffice charge initialement seulement le tableau de bord et les notifications. Les produits et commandes sont chargés à l'ouverture de leurs modules.
- Les index `customer_recent`, `order_expired_state` et `product_low_stock_state` ont été ajoutés. Un index de commandes redondant testé pendant l'audit a été retiré : l'index existant `status_1_createdAt_1` couvre déjà le tri dans les deux sens.
- Le script `npm run check:performance` contrôle les index, les plans d'exécution et les temps médians des services critiques.

## Résultats avant / après

| Route | Avant, chaud | Après, chaud | Gain approximatif |
| --- | ---: | ---: | ---: |
| Notifications | 879 ms | 111 à 123 ms | 86 à 87 % |
| Clientes | 722 ms | 111 à 124 ms | 83 à 85 % |
| Commandes | 241 ms | 115 à 124 ms | 49 à 52 % |
| Produits | 131 ms | 125 ms | inchangé, pas de problème confirmé |

Le chargement initial authentifié du backoffice passe de 4 appels et environ 24,6 Ko de JSON à 2 appels et environ 5,7 Ko, soit environ 77 % de données API en moins avant l'affichage du tableau de bord.

La pagination ajoute quelques octets de métadonnées avec seulement deux commandes, mais plafonne désormais la réponse à 8 commandes par page au lieu de croître avec tout l'historique.

## Frontend

- Démarrage de `next start` : 739 ms.
- Pages publiques chaudes : environ 142 à 162 ms côté serveur local.
- Page `/admin` chaude : environ 15 ms côté serveur local.
- Premier appel froid observé sur `/` : 841 ms.
- Ressources initiales partagées : environ 1,06 Mo non compressé. Elles sont immuables et mises en cache ; la compression/CDN de production doit être vérifiée après déploiement avant d'engager une réduction du design ou des dépendances.
- Intégrité des images : 23 références, 23 fichiers GridFS, aucun orphelin et aucune référence manquante.

## Contrôles réussis

- `npm run build` dans le backend.
- `npm run check:performance`.
- `npm run check:db`.
- `npm run check:customers`.
- `npm run check:notifications`.
- `npm run check:orders`.
- `npm run check:stock`.
- `npm run check:security`.
- `npm run check:monitoring`.
- `npm run check:images`.
- `npm run type-check`, `npm run lint`, `npm run build` et `npm run check:seo` dans le frontend.
- La pagination et la recherche de commandes ont aussi été testées via l'API authentifiée.

ESLint conserve dix avertissements préexistants dans `button.tsx`, sans erreur et sans lien avec cette phase.

## Limites restantes

- La reconstruction des profils clientes et la synchronisation globale des notifications restent proportionnelles au nombre de commandes/produits lors des mutations. Elles ne bloquent plus les lectures, mais devront devenir incrémentales si le volume augmente fortement.
- La recherche partielle des commandes utilise des expressions régulières. C'est acceptable au volume actuel ; à plusieurs milliers de commandes, un index de recherche dédié ou Atlas Search sera préférable.
- Les listes publiques et le catalogue administrateur ne sont pas paginés. Avec 11 produits, une pagination ajouterait aujourd'hui de la complexité sans gain mesurable. Il faudra réévaluer ce choix quand le catalogue grandira.
- Le bootstrap backend compilé prend environ 7,8 secondes, principalement pour la connexion Atlas, les migrations et les synchronisations initiales. Ce coût doit être surveillé sur l'hébergeur en cas de mises en veille fréquentes.
- Les mesures locales ne remplacent pas un Lighthouse et un suivi Web Vitals sur l'URL réellement déployée.

## Conclusion

La phase 11 est validée. Les ralentissements confirmés ont été corrigés sans modifier le design ni affaiblir les règles de stock, commandes, clientes ou notifications. La phase suivante ne doit pas commencer sans validation explicite.
