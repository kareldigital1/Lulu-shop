# Frontend Tata Lulu Shop

Application Next.js du storefront et du backoffice Tata Lulu Shop.

## Démarrage local

```bash
cp .env.example .env.local
npm install
npm run dev
```

Le site est ensuite disponible sur `http://localhost:3000`. Le backend doit
être lancé séparément sur l'origine définie par `NEXT_PUBLIC_API_BASE_URL`.

## Commandes

```bash
npm run dev
npm run lint
npm run check:seo
npm run build
npm run start
```

`npm run check:seo` suppose que le frontend et le backend sont démarrés. Il
contrôle le sitemap, robots.txt, les canonical, Open Graph, Twitter Cards, les
données structurées produit et le `noindex` du backoffice.

`npm run build` doit également pouvoir joindre le backend : la génération de
`sitemap.xml` charge les produits depuis `NEXT_PUBLIC_API_BASE_URL`. Un backend
arrêté ou une URL incorrecte fait donc échouer le build de production.

## Configuration

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Ces deux valeurs sont publiques et intégrées au bundle au moment du build.
Aucun secret backend ne doit être ajouté dans ce dossier.

En production, `NEXT_PUBLIC_APP_URL` doit contenir l'origine publique exacte,
sans chemin. Si elle est absente sur Vercel, l'application utilise
`VERCEL_PROJECT_PRODUCTION_URL` comme solution de repli.

## Documentation

- [Architecture](../docs/architecture.md)
- [API](../docs/api.md)
- [Base de données](../docs/database.md)
- [Environnement et déploiement](../docs/environment.md)
- [Procédure de déploiement](../docs/deployment.md)
