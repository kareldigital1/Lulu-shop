# Audit de sécurité - Phase 1

Date : 30 juillet 2026

## Périmètre

L'audit couvre le frontend Next.js, l'API Express, MongoDB, les uploads
GridFS, l'authentification admin, les dépendances, les variables
d'environnement et les principales surfaces XSS et NoSQL.

Il ne constitue pas un test d'intrusion externe de Render, Vercel, MongoDB
Atlas ou Gmail.

## Protections déjà présentes

Avant les corrections, le projet possédait déjà :

- une liste CORS limitée aux URL du frontend ;
- une validation Zod sur les principales entrées ;
- un JWT admin expirant après 12 heures ;
- une authentification sur toutes les routes `/api/admin/*` ;
- un upload limité à un fichier de 5 Mo et à trois types MIME ;
- un gestionnaire d'erreurs centralisé ;
- une validation des variables d'environnement ;
- une exclusion Git des fichiers `.env` ;
- des recherches MongoDB construites côté serveur avec les expressions
  régulières échappées ;
- un logger qui masque les mots de passe, jetons, cookies et URI MongoDB ;
- l'échappement des valeurs insérées dans les e-mails HTML.

## Problèmes confirmés et corrections

| Gravité | Problème | Correction |
| --- | --- | --- |
| Élevée | Next.js `16.2.10` était concerné par plusieurs avis de sécurité | Mise à jour vers `16.2.12` |
| Élevée | `sharp` et le PostCSS embarqué restaient vulnérables | Versions corrigées imposées et testées avec le build |
| Élevée | Le login n'avait aucune protection contre les tentatives répétées | Limite de 10 échecs par IP sur 15 minutes |
| Moyenne | Les créations de commandes et contacts pouvaient être automatisées sans limite | Limite commune de 20 écritures par IP sur 15 minutes |
| Moyenne | Les uploads et sauvegardes pouvaient consommer trop de ressources | Limites dédiées par IP |
| Moyenne | Aucun en-tête de sécurité cohérent n'était envoyé | Helmet sur l'API et CSP/en-têtes sur Next.js |
| Moyenne | GridFS faisait confiance au type MIME déclaré par le navigateur | Vérification des signatures JPG, PNG et WebP avant stockage |
| Moyenne | Le résultat nettoyé par Zod n'était pas appliqué à la requête | Corps, paramètres et requêtes remplacés par les données validées |
| Moyenne | Plusieurs textes et tableaux n'avaient pas de limite métier | Limites maximales ajoutées sans réduire les usages normaux |
| Moyenne | Le JSON-LD pouvait contenir une fermeture de balise `script` | Sérialisation dédiée qui neutralise `<`, `>`, `&` et les séparateurs Unicode |
| Moyenne | Les secrets minimaux étaient trop faibles et les exemples étaient acceptés | 12 caractères pour l'admin, 32 pour JWT, exemples refusés |
| Faible | JWT acceptait plusieurs algorithmes HMAC à la vérification | Signature et vérification limitées à `HS256` |
| Faible | Certains identifiants MongoDB invalides atteignaient Mongoose | Validation ObjectId avant les services |
| Faible | JSON invalide ou trop volumineux pouvait devenir une erreur `500` | Réponses JSON `400` et `413` explicites |
| Faible | Le jeton admin persistait après fermeture du navigateur | Migration de `localStorage` vers `sessionStorage` |

## Limites appliquées

| Surface | Limite |
| --- | --- |
| Échecs de connexion | 10 sur 15 minutes |
| Commandes et contacts publics | 20 sur 15 minutes |
| Uploads admin | 30 sur 15 minutes |
| Sauvegardes admin | 10 sur 15 minutes |
| Corps JSON | 100 Ko |
| Image | 5 Mo, un fichier, JPG/PNG/WebP |

Les lectures publiques ne sont pas limitées par IP. Les limiter derrière
l'adresse partagée d'un serveur Next.js pourrait rendre le catalogue
indisponible pour toutes les clientes à la fois.

## Vérifications réalisées

- build TypeScript backend : réussi ;
- contrôle automatisé `npm run check:security` : réussi ;
- connexion MongoDB Atlas avec `npm run check:db` : réussie ;
- lecture boutique, catalogue, produits admin, dashboard, audit et stock :
  réponses `200` ;
- TypeScript frontend : réussi ;
- ESLint frontend : aucune erreur, dix avertissements préexistants ;
- build Next.js `16.2.12` : réussi ;
- démarrage du build de production : réussi ;
- en-tête CSP et protection anti-iframe : présents ;
- optimisation réelle d'une image avec `sharp@0.35.0` : réponse WebP `200` ;
- audit npm des dépendances de production frontend et backend :
  zéro vulnérabilité connue.

Le contrôle automatisé vérifie aussi :

- le rejet d'une origine CORS non autorisée ;
- le rejet d'une route admin sans JWT ;
- le rejet d'un opérateur NoSQL envoyé à la place d'un e-mail ;
- le blocage de la onzième tentative de connexion ;
- le rejet d'un faux PNG contenant du HTML ;
- le rejet d'un JWT signé en `HS512` ;
- le nettoyage et la coercition des valeurs Zod ;
- les réponses `400` et `413` du parseur JSON.

## Risques résiduels

### Jeton dans le navigateur

Le JWT est maintenant limité à la session de l'onglet, mais reste lisible par
JavaScript. Un cookie `HttpOnly` serait plus robuste contre un futur XSS, mais
le frontend Vercel et le backend Render sont actuellement sur des sites
différents. Cette migration exigerait des cookies cross-site, une protection
CSRF et une modification coordonnée de tous les appels admin. Elle n'a pas été
introduite silencieusement pendant cet audit.

### Limiteur en mémoire

Le limiteur est adapté à une seule instance backend. Il est réinitialisé lors
d'un redémarrage et n'est pas partagé entre plusieurs instances. Si le backend
est répliqué horizontalement, il faudra utiliser un store Redis partagé.

### CSP et outils de développement

La CSP conserve `unsafe-inline` pour les scripts et styles nécessaires au
rendu Next.js actuel. Une CSP stricte avec nonce demande un proxy Next.js et
un rendu dynamique coordonné.

L'audit npm complet du frontend signale encore neuf avis élevés provenant des
dépendances transitives de la chaîne ESLint autour de `minimatch`. Elles sont
utilisées uniquement pendant le développement et aucun correctif compatible
avec la configuration Next.js actuelle n'est disponible. Les dépendances
réellement déployées sont à zéro vulnérabilité connue.

## Commandes de contrôle

```bash
cd backend-lulu
npm run build
npm run check:security
npm run check:db
npm audit

cd ../lulu_shop_front
npm run type-check
npm run lint
npm run build
npm audit --omit=dev
```
