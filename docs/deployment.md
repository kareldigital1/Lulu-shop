# Déploiement de Tata Lulu Shop

Date de validation : 31 juillet 2026

## Architecture de production

- Frontend Next.js : Vercel, racine `lulu_shop_front`.
- API Express : service Web Render, racine `backend-lulu`.
- Données et images : MongoDB Atlas, base `lulu_shop` et GridFS.
- E-mails : Gmail SMTP si l'hébergeur autorise les ports SMTP.

Le frontend n'est pas un export statique. Il utilise les Server Components,
les routes dynamiques et l'optimisation d'images de Next.js ; il doit donc être
déployé comme application Next.js, pas comme simple dossier HTML.

## Prérequis avant le premier déploiement

1. Le dépôt doit être disponible sur GitHub, GitLab ou Bitbucket.
2. MongoDB Atlas doit contenir un utilisateur dédié à l'application avec un
   mot de passe unique et des droits limités à la base utile.
3. Ajoute dans l'IP Access List Atlas les plages sortantes visibles dans
   **Render > service > Connect > Outbound**. N'utilise `0.0.0.0/0` qu'en
   dernier recours temporaire, avec des identifiants Atlas robustes.
4. Prépare un `ADMIN_PASSWORD` unique et un `JWT_SECRET` aléatoire d'au moins
   32 caractères.
5. Utilise Node.js 20.9 ou plus récent pour le frontend Next.js 16.

Références officielles : [monorepos Render](https://render.com/docs/monorepo-support),
[IP sortantes Render](https://render.com/docs/outbound-ip-addresses),
[monorepos Vercel](https://vercel.com/docs/monorepos) et
[configuration réseau Atlas](https://www.mongodb.com/docs/atlas/security/ip-access-list/).

## 1. Déployer le backend sur Render

Crée un **Web Service** relié au dépôt et utilise ces réglages :

| Réglage Render | Valeur |
| --- | --- |
| Root Directory | *(racine du dépôt, laisser vide)* |
| Runtime | Node |
| Build Command | `corepack enable pnpm && pnpm install --frozen-lockfile && pnpm --filter backend-lulu build` |
| Start Command | `pnpm --filter backend-lulu start` |
| Health Check Path | `/api/ready` |

> Depuis le passage au workspace pnpm, `pnpm-lock.yaml` se trouve à la racine du
> dépôt et non dans `backend-lulu`. Le Root Directory doit donc rester la racine,
> sinon l'installation échoue faute de lockfile.

Ajoute les variables suivantes dans **Environment** :

```env
NODE_ENV=production
LOG_LEVEL=info
MONGO_URI=<URI_ATLAS_AVEC_LULU_SHOP>
CORS_ORIGIN=<URL_HTTPS_EXACTE_DU_FRONTEND>
FRONTEND_URL=<URL_HTTPS_EXACTE_DU_FRONTEND>
ADMIN_EMAIL=tatalulushop@gmail.com
ADMIN_PASSWORD=<MOT_DE_PASSE_ADMIN_UNIQUE>
JWT_SECRET=<SECRET_ALEATOIRE_D_AU_MOINS_32_CARACTERES>
GMAIL_USER=tatalulushop@gmail.com
GMAIL_APP_PASSWORD=<MOT_DE_PASSE_APPLICATION_GOOGLE>
LOW_STOCK_EMAIL=tatalulushop@gmail.com
NEW_PRODUCT_BADGE_DAYS=30
PENDING_ORDER_EXPIRATION_HOURS=72
ORDER_NOTIFICATION_EMAIL=tatalulushop@gmail.com
MAIL_FROM_NAME=Tata Lulu Shop
```

Ne définis pas manuellement `PORT` sur Render sauf besoin particulier : la
plateforme l'injecte et le backend la lit déjà.

### Limite importante du plan Render gratuit

Les services Web gratuits Render se mettent en veille après une période
d'inactivité et peuvent mettre environ une minute à redémarrer. Ils bloquent
aussi les connexions sortantes sur les ports SMTP 25, 465 et 587. Le backend
continuera d'enregistrer les commandes, mais Gmail SMTP ne pourra pas envoyer
les alertes depuis cette offre gratuite.

Pour conserver les e-mails, utilise un service Render qui autorise SMTP ou
remplace ultérieurement le transport par une API e-mail HTTPS. Ne considère
jamais l'absence de mail comme l'échec d'enregistrement d'une commande.

Référence : [limites Render Free](https://render.com/docs/free).

## 2. Déployer le frontend sur Vercel

Importe le même dépôt dans Vercel et sélectionne :

| Réglage Vercel | Valeur |
| --- | --- |
| Framework Preset | Next.js |
| Root Directory | `lulu_shop_front` |
| Include source files outside Root Directory | **activé** |
| Install Command | `pnpm install --frozen-lockfile` ou valeur automatique |
| Build Command | `pnpm build` ou valeur automatique |
| Output Directory | laisser vide / valeur Next.js automatique |

Ajoute pour l'environnement **Production** :

```env
NEXT_PUBLIC_API_BASE_URL=https://URL-DU-BACKEND.onrender.com
NEXT_PUBLIC_APP_URL=https://URL-DU-FRONTEND.vercel.app
```

Ces valeurs sont intégrées pendant le build. Toute modification exige un
nouveau déploiement. N'ajoute jamais `MONGO_URI`, `JWT_SECRET`, le mot de passe
admin ou le secret Gmail dans Vercel : le navigateur n'en a pas besoin.

### Dépendance du build envers le backend

La génération de `sitemap.xml` charge les produits depuis
`NEXT_PUBLIC_API_BASE_URL` pendant `next build`. Le backend Render doit donc
être déployé, réveillé et répondre à `/api/products` avant de lancer ou de
relancer le déploiement Vercel. Une URL erronée, un backend indisponible ou un
réveil Render Free plus long que le délai HTTP fait échouer le build.

Avant un déploiement Vercel manuel, ouvre `/api/ready` puis `/api/products` sur
l'URL Render et vérifie leurs réponses. Cette dépendance est volontairement
documentée mais reste un point de fragilité : une évolution future devrait
rendre le sitemap tolérant à une indisponibilité temporaire de l'API.

## 3. Finaliser les URL croisées

Le premier déploiement sert souvent à obtenir les URL définitives :

1. récupère l'URL Render du backend ;
2. renseigne-la dans `NEXT_PUBLIC_API_BASE_URL` sur Vercel ;
3. récupère l'URL de production Vercel ;
4. renseigne cette URL exacte dans `CORS_ORIGIN` et `FRONTEND_URL` sur Render ;
5. renseigne-la aussi dans `NEXT_PUBLIC_APP_URL` sur Vercel ;
6. redéploie d'abord Render, puis Vercel.

Une URL de Preview Vercel différente n'est pas autorisée automatiquement par
le CORS actuel. Ne remplace pas l'origine par `*` pour contourner le problème.

## 4. Vérifier le déploiement

Exécute cette checklist dans l'ordre :

1. `GET https://BACKEND/api/health` retourne `200`.
2. `GET https://BACKEND/api/ready` retourne `200` et `database: "connected"`.
3. L'accueil, `/produits`, une fiche produit et `/a-propos` répondent.
4. Les images GridFS s'affichent depuis le domaine Render.
5. La connexion `/admin` fonctionne et les routes admin refusent un appel sans
   JWT.
6. Une commande test reçoit une vraie référence `TL-...` et apparaît dans le
   backoffice.
7. La confirmation diminue le stock, l'annulation le restaure et la commande
   test peut ensuite être supprimée ou conservée comme trace selon la procédure
   choisie.
8. Le sitemap utilise le domaine Vercel définitif et `/admin` reste `noindex`.
9. Télécharge une archive MongoDB depuis **Sauvegardes** et valide-la avec
   `pnpm --filter backend-lulu restore:backup -- "<DOSSIER_EXTRAIT>"`.
10. Contrôle les logs Render pour les erreurs MongoDB, CORS ou e-mail.

## 5. Déployer une mise à jour

Avant chaque mise en production :

```bash
# Depuis la racine du dépôt
pnpm install --frozen-lockfile
pnpm test
pnpm type-check
pnpm --filter backend-lulu build
pnpm --filter backend-lulu check:db
# Démarrer ou déployer le backend, puis vérifier /api/ready et /api/products.

pnpm --filter lulu_shop_front lint
pnpm --filter lulu_shop_front build
```

Après le déploiement, refais au minimum les contrôles `/api/ready`, catalogue,
connexion admin, panier et création d'une commande. Une compilation réussie
ne prouve pas que CORS, Atlas ou les variables de production sont corrects.

## Retour arrière

1. Utilise le rollback Render ou Vercel vers le dernier déploiement sain.
2. Ne restaure pas MongoDB simplement parce que le code a été rollbacké.
3. Si les données sont réellement corrompues, suis exclusivement la procédure
   [backup-restore-procedure.md](backup-restore-procedure.md) vers une nouvelle
   base vide, puis valide-la avant de changer `MONGO_URI` sur Render.
