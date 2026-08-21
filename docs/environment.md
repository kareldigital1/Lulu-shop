# Variables d'environnement

## Règles de sécurité

- Les fichiers `.env` et `.env.local` ne doivent jamais être commités.
- Seuls les noms commençant par `NEXT_PUBLIC_` sont visibles dans le navigateur.
- `MONGO_URI`, `ADMIN_PASSWORD`, `JWT_SECRET` et `GMAIL_APP_PASSWORD` sont des
  secrets backend.
- Les valeurs de `.env.example` sont des exemples, jamais des identifiants de
  production.
- Après la fuite d'un secret, il faut le remplacer à la source ; le retirer du
  fichier ne suffit pas.

## Backend

Fichier local : `backend-lulu/.env`.

| Variable | Obligatoire | Valeur conseillée | Rôle |
| --- | --- | --- | --- |
| `NODE_ENV` | Non | `development` ou `production` | Mode d'exécution |
| `LOG_LEVEL` | Non | `info` | Niveau des logs Pino |
| `PORT` | Non | `8000` | Port HTTP local ; Render peut l'injecter |
| `MONGO_URI` | Oui | URI Atlas avec `/lulu_shop` | Connexion MongoDB |
| `CORS_ORIGIN` | Non | URL du frontend | Origine autorisée par CORS |
| `FRONTEND_URL` | Non | URL du frontend | Liens envoyés par le backend |
| `ADMIN_EMAIL` | Non | Adresse de l'admin | Identifiant du backoffice |
| `ADMIN_PASSWORD` | Oui | Mot de passe fort, 12 caractères minimum | Secret de connexion admin |
| `JWT_SECRET` | Oui | Chaîne aléatoire de 32 caractères ou plus | Signature des jetons admin |
| `GMAIL_USER` | Non | Compte Gmail expéditeur | Envoi des notifications |
| `GMAIL_APP_PASSWORD` | Non | Mot de passe d'application Google | Authentification SMTP |
| `LOW_STOCK_EMAIL` | Non | `tatalulushop@gmail.com` | Destinataire du stock faible |
| `NEW_PRODUCT_BADGE_DAYS` | Non | `30` | Durée du badge Nouveau, `0` le désactive |
| `PENDING_ORDER_EXPIRATION_HOURS` | Non | `72` | Expiration des commandes en attente |
| `NOTIFICATION_RETENTION_DAYS` | Non | `90` | Conservation des notifications lues et résolues |
| `ORDER_NOTIFICATION_EMAIL` | Non | Adresse de l'admin | Destinataire des nouvelles commandes |
| `MAIL_FROM_NAME` | Non | `Tata Lulu Shop` | Nom affiché par les e-mails |

Exemple local :

```env
NODE_ENV=development
LOG_LEVEL=info
PORT=8000
MONGO_URI=mongodb+srv://UTILISATEUR:MOT_DE_PASSE@CLUSTER/lulu_shop?retryWrites=true&w=majority
CORS_ORIGIN=http://localhost:3000
FRONTEND_URL=http://localhost:3000
ADMIN_EMAIL=tatalulushop@gmail.com
ADMIN_PASSWORD=REMPLACER_PAR_UN_SECRET
JWT_SECRET=REMPLACER_PAR_UN_LONG_SECRET_ALEATOIRE
GMAIL_USER=tatalulushop@gmail.com
GMAIL_APP_PASSWORD=REMPLACER_PAR_LE_MOT_DE_PASSE_APPLICATION
LOW_STOCK_EMAIL=tatalulushop@gmail.com
NEW_PRODUCT_BADGE_DAYS=30
PENDING_ORDER_EXPIRATION_HOURS=72
ORDER_NOTIFICATION_EMAIL=tatalulushop@gmail.com
MAIL_FROM_NAME=Tata Lulu Shop
```

Si le mot de passe MongoDB contient `@`, `:`, `/`, `?`, `#` ou `%`, il doit
être encodé dans l'URI. Utilise le mot de passe d'application Gmail, jamais le
mot de passe normal du compte Google.

## Frontend

Fichier local : `lulu_shop_front/.env.local`.

| Variable | Obligatoire | Valeur locale | Rôle |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Oui | `http://localhost:8000` | Origine de l'API Express |
| `NEXT_PUBLIC_APP_URL` | Oui | `http://localhost:3000` | URL canonique du site |

Exemple :

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

En production, `NEXT_PUBLIC_APP_URL` doit etre l'origine publique definitive
du frontend, par exemple `https://tata-lulu-shop.vercel.app`, sans chemin ni
slash final. Cette valeur alimente les canonical, Open Graph, les donnees
structurees, `robots.txt` et `sitemap.xml`. Sur Vercel,
`VERCEL_PROJECT_PRODUCTION_URL` sert de repli si la variable publique est
absente, mais une valeur explicite reste recommandee lors de l'utilisation
d'un domaine personnalise.

Ces variables sont intégrées au bundle Next.js pendant le build. Une
modification dans Vercel exige donc un nouveau déploiement.

## Production Render et Vercel

La procédure complète et les commandes exactes sont dans
[deployment.md](deployment.md). Les points ci-dessous sont seulement le résumé
de configuration.

### Backend Render

1. Ajoute toutes les variables backend dans **Environment**.
2. Mets `NODE_ENV=production`.
3. Mets `CORS_ORIGIN` et `FRONTEND_URL` à l'URL HTTPS exacte de Vercel, sans
   chemin supplémentaire.
4. Vérifie dans Atlas que Render peut joindre le cluster.
5. Redéploie puis vérifie `https://URL_BACKEND/api/health`.
6. Configure `/api/ready` comme Health Check Path afin de vérifier aussi Atlas.

### Frontend Vercel

1. Ajoute `NEXT_PUBLIC_API_BASE_URL=https://URL_BACKEND`.
2. Ajoute `NEXT_PUBLIC_APP_URL=https://URL_FRONTEND`.
3. Active les valeurs pour Production et Preview seulement si le backend
   autorise aussi l'origine Preview.
4. Redéploie le frontend.

Avec la configuration CORS actuelle, une seule origine est autorisée. Mettre
`*` pour contourner un problème est une mauvaise solution : le backoffice
utilise une authentification et doit conserver une liste d'origines maîtrisée.

Attention : le plan Web gratuit de Render bloque les ports SMTP 25, 465 et
587. Les commandes restent enregistrées, mais les e-mails Gmail ne partiront
pas depuis ce plan. Voir [deployment.md](deployment.md) pour les options.

## Générer un JWT secret

Dans PowerShell avec Node.js :

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Le résultat va dans `JWT_SECRET`. Ce n'est pas un jeton utilisateur : le
backend l'utilise pour signer les jetons créés après la connexion.

## Vérification

Depuis `backend-lulu` :

```bash
pnpm --filter backend-lulu check:db
```

Cette commande valide la configuration et la connexion Atlas. En cas d'échec,
contrôle dans cet ordre : l'URI, l'utilisateur de base de données, son mot de
passe, l'accès réseau Atlas et le nom de la base.
