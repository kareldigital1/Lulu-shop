# Audit SEO - Phase 5

Date : 30 juillet 2026

## Perimetre

- Sitemap XML
- Robots.txt
- Titres et descriptions
- URLs canonical
- Open Graph
- Twitter Cards
- Donnees structurees Schema.org
- Indexation du backoffice
- Mise a jour du catalogue dans le sitemap

## Etat trouve

### Deja en place

- `sitemap.ts` exposait l'accueil, le catalogue, la page a propos et les
  produits actifs.
- `robots.ts` autorisait l'exploration et referenceait le sitemap.
- L'accueil, le catalogue et la page a propos avaient un titre et une
  description.
- Les fiches produit utilisaient `generateMetadata`.
- Les fiches produit avaient des donnees structurees `Product`.
- L'accueil avait des donnees structurees `ClothingStore`.
- Le backoffice declarait `noindex, nofollow`.
- Le fichier HTML de validation Google Search Console etait present.

### Manques et anomalies confirmes

- Aucune page publique ne declarait d'URL canonical.
- L'accueil, le catalogue et la page a propos n'avaient pas de balises Open
  Graph.
- Aucune Twitter Card n'etait produite.
- Aucune image sociale adaptee au partage n'existait.
- `metadataBase` n'etait pas configure.
- Les donnees structurees produit declaraient la devise, mais pas le prix.
- Les fiches produit n'avaient pas de fil d'Ariane structure.
- Le backoffice heritait de la description publique de la boutique et son
  titre utilisait un nom incomplet.
- Toutes les URLs du sitemap recevaient la date courante a chaque generation,
  meme sans modification.
- Le sitemap etait genere au build. Un produit ajoute depuis le backoffice
  pouvait rester absent jusqu'au prochain deploiement.
- Les constructions d'URL etaient dupliquees dans plusieurs fichiers.

## Modifications realisees

- Centralisation de l'origine publique dans `src/lib/site-url.ts`.
- Utilisation de `NEXT_PUBLIC_APP_URL`, puis de
  `VERCEL_PROJECT_PRODUCTION_URL` comme repli Vercel.
- Ajout de `metadataBase`.
- Ajout d'une canonical sur l'accueil, le catalogue, a propos et chaque fiche
  produit.
- Ajout de metadonnees Open Graph et Twitter propres a chaque page.
- Creation d'une carte sociale 1200 x 630 aux couleurs de Tata Lulu Shop.
- Ajout de `WebSite`, `ClothingStore`, `ContactPoint` et `hasMap` sur
  l'accueil.
- Ajout du prix, du SKU, du vendeur, de toutes les images et de l'URL dans les
  donnees structurees produit.
- Ajout d'un `BreadcrumbList` sur chaque fiche produit.
- Ajout de `noindex, nofollow` pour les fiches introuvables.
- Correction du titre admin en `Backoffice | Tata Lulu Shop`.
- Suppression de l'heritage Open Graph et Twitter sur le backoffice.
- Ajout du champ de lecture `updatedAt` dans le modele frontend produit. Il
  reste exclu des donnees modifiables par le formulaire admin.
- Utilisation de la vraie date `updatedAt` dans le sitemap.
- Suppression des fausses dates de modification sur les pages fixes.
- Revalidation horaire du sitemap pour integrer les nouveaux produits sans
  redeploiement.
- Le sitemap interroge directement le catalogue : une erreur API fait echouer
  la revalidation au lieu de remplacer silencieusement le sitemap valide par
  une liste vide.
- Ajout de la commande reproductible `npm run check:seo`.

## Resultats SEO controles

| Controle | Resultat |
| --- | --- |
| URLs dans le sitemap | 14 |
| Produits publies dans le sitemap | 11 |
| Pages publiques avec canonical | 4 parcours controles |
| Pages publiques avec Open Graph | 4 parcours controles |
| Pages publiques avec Twitter Card | 4 parcours controles |
| Image Open Graph | PNG 1200 x 630, 77 739 octets |
| Image Twitter | PNG 1200 x 630, 77 739 octets |
| Prix produit Schema.org | 5 000 XOF sur le produit controle |
| Fil d'Ariane Schema.org | Present |
| Backoffice | `noindex, nofollow` |
| Backoffice dans le sitemap | Absent |

## Non-regression

- Verification TypeScript frontend : reussie.
- ESLint frontend : 0 erreur et 10 avertissements preexistants dans
  `button.tsx`.
- Build Next.js de production : reussi.
- Controle SEO sur le serveur de developpement : reussi.
- Controle SEO sur `next start` apres build : reussi.
- Build TypeScript backend : reussi.
- Connexion MongoDB Atlas : reussie.
- Controles de securite backend : reussis.
- Controle GridFS : 0 fichier orphelin, 0 bloc orphelin et 0 reference
  manquante.
- Controles de monitoring : reussis.

## Risques restants

- `NEXT_PUBLIC_APP_URL` doit etre mis a jour avec le vrai domaine de production.
  Une ancienne URL Render produirait de mauvaises canonical.
- Les images produit Open Graph viennent du backend. Son URL publique doit
  rester disponible en HTTPS pour les robots des reseaux sociaux.
- Google Search Console peut prendre plusieurs jours ou semaines avant de
  refleter les corrections. Le code ne garantit pas une position dans les
  resultats.
- Aucun `AggregateRating` ou avis Schema.org n'a ete ajoute, car le projet ne
  possede pas de vrais avis produits. Fabriquer ces donnees serait trompeur.
- Le sitemap se revalide au maximum une fois par heure. Ce delai est volontaire
  pour eviter une requete MongoDB a chaque passage d'un robot.
- Une verification Rich Results et un nouveau depot du sitemap devront etre
  effectues apres le deploiement sur le domaine final.

La phase 6 n'a pas ete commencee.
