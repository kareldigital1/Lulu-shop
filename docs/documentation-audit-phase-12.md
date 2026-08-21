# Audit de documentation — phase 12

Date : 31 juillet 2026

## 1. Ce qui existait déjà

Le projet possédait déjà une documentation structurée pour l'architecture,
l'API, MongoDB, les variables d'environnement et la restauration des
sauvegardes. Les rapports des phases 1 à 11 fournissaient aussi un historique
technique utile.

Les fichiers `.env.example` du backend et du frontend contenaient toutes les
variables actuellement validées par le code. Aucun secret réel n'a été ajouté
à la documentation.

## 2. Ce qui manquait réellement

- Une procédure de déploiement complète avec les racines du monorepo, les
  commandes Render/Vercel, l'ordre de configuration des URL et la checklist de
  production.
- La route `/api/ready`, la suppression d'images et la pagination serveur des
  commandes dans la documentation API.
- Les valeurs exactes des tris clientes.
- Les index ajoutés pendant la phase de performance.
- Les modules clientes, monitoring et notifications administrateur dans le
  schéma d'architecture.
- La nouvelle règle selon laquelle les synchronisations clientes et
  notifications ne sont plus exécutées avant chaque lecture.
- Les mouvements `product_created` et `product_deleted` dans la documentation
  du stock.
- Les liens vers tous les rapports d'audit depuis le README principal.

## 3. Risques identifiés

- Une ancienne phrase indiquait que l'expiration était vérifiée à chaque
  chargement des commandes, alors que ce comportement a été supprimé pendant
  la phase 11.
- La documentation API annonçait des valeurs de tri clientes refusées par Zod.
- La route de notifications était décrite comme une lecture avec
  synchronisation, ce qui contredisait l'optimisation réellement déployée.
- La procédure de restauration mentionnait `MONGO_URI` sur Vercel, alors que
  ce secret ne doit exister que sur le backend Render.
- Le plan Web gratuit Render bloque les ports SMTP. Sans cette information,
  l'administratrice pouvait croire que le code e-mail était défectueux alors
  que la restriction vient de l'hébergeur.
- Le build Next.js génère le sitemap à partir des produits de l'API. Il échoue
  si le backend n'est pas joignable et peut donc être fragilisé par la veille
  du plan Render gratuit.

## 4. Modifications effectuées

- Mise à jour de `architecture.md`, `database.md`, `api.md` et
  `environment.md` à partir du code actuel.
- Création de `deployment.md` avec la configuration Render, Vercel, Atlas, les
  vérifications post-déploiement et la procédure de retour arrière.
- Correction et revalidation de `backup-restore-procedure.md`.
- Mise à jour des README racine et frontend pour rendre toute la documentation
  accessible.
- Ajout du présent rapport de phase 12.

## 5. Contrôles réalisés

- Comparaison des routes Express avec `docs/api.md`.
- Comparaison des schémas Zod avec les paramètres documentés.
- Comparaison des modèles et index Mongoose avec `docs/database.md`.
- Comparaison du schéma `env.ts` avec les deux fichiers `.env.example`.
- Vérification des scripts NPM réellement disponibles.
- Vérification des procédures Render, Vercel et Atlas avec leurs
  documentations officielles au 31 juillet 2026.
- Vérification automatisée des liens Markdown locaux.
- Build TypeScript backend et connexion réelle à MongoDB Atlas.
- Type-check et ESLint sans erreur; 10 avertissements non bloquants restent
  dans `button.tsx`.
- Build Next.js validé avec le backend actif. Le premier essai avec le backend
  arrêté a correctement exposé la dépendance du sitemap à l'API.

## 6. Résultat

La documentation couvre désormais l'architecture, les collections MongoDB,
l'API, les variables d'environnement, le déploiement, la sauvegarde et la
restauration. Les instructions correspondent au comportement du code de la
version actuelle.

La documentation doit être mise à jour dans la même modification que toute
future route, variable d'environnement, collection, transition de commande ou
procédure d'exploitation.
