# Procedure de restauration MongoDB

Date de validation : 31 juillet 2026

## Objectif

Cette procedure restaure une archive ZIP MongoDB produite depuis la page
**Sauvegardes** du backoffice. Elle conserve les documents, les index et les
images GridFS.

Le fichier JSON lisible n'est pas adapte a une restauration complete : il
n'inclut pas les blocs `productImages.chunks` et ne conserve pas tous les types
BSON. Utilise toujours l'archive MongoDB ZIP pour une reprise.

## Regles de securite

- Ne restaure jamais directement dans `lulu_shop`.
- Utilise une nouvelle base vide dont le nom contient au maximum 38 caracteres.
- Ne mets pas l'URI MongoDB dans la ligne de commande ou dans un message.
- Conserve l'archive dans un espace prive et chiffre : elle peut contenir des
  coordonnees clientes.
- Ne remplace l'URI de production qu'apres verification fonctionnelle de la
  base restauree.

L'outil refuse automatiquement :

- une archive dont le manifeste, les comptes, les index ou GridFS sont
  incoherents ;
- un chemin de fichier sortant du dossier extrait ;
- une restauration dans la base source ;
- une base cible qui contient deja une collection ;
- une execution sans confirmation exacte.

Si une erreur survient apres le debut de l'ecriture, l'outil supprime
automatiquement la base cible qu'il venait de creer. Il ne supprime jamais une
base qui contenait deja des collections.

## Etape 1 - Telecharger

1. Ouvre le backoffice.
2. Va dans **Sauvegardes**.
3. Telecharge **Archive MongoDB complete**.
4. Conserve une copie intacte du fichier ZIP.
5. Extrais le ZIP dans un nouveau dossier.

Le dossier extrait doit contenir :

- `manifest.json`
- `collections/`
- `indexes/`
- `RESTAURATION.txt`

## Etape 2 - Valider sans ecrire

Depuis la racine du dépôt :

```powershell
pnpm --filter backend-lulu restore:backup -- "C:\Sauvegardes\tata-lulu-shop-mongodb-extrait"
```

Sous Linux ou macOS :

```bash
pnpm --filter backend-lulu restore:backup -- "/home/user/backups/tata-lulu-shop-mongodb-extrait"
```

Le message attendu commence par :

```text
Sauvegarde MongoDB valide. Aucune donnee n'a ete ecrite.
```

Le resume doit indiquer les collections, documents, index, fichiers GridFS,
blocs GridFS et octets binaires trouves.

## Etape 3 - Choisir une base cible

Choisis un nom neuf et court, par exemple :

```text
lulu_shop_restore_20260730
```

La cible doit etre une base differente de `lulu_shop` et ne contenir aucune
collection.

Dans la session PowerShell courante :

```powershell
$env:RESTORE_MONGO_URI = "<URI_MONGODB_ATLAS>"
$env:RESTORE_DATABASE = "lulu_shop_restore_20260730"
$env:RESTORE_CONFIRMATION = "RESTORE-$env:RESTORE_DATABASE"
```

Sous Linux ou macOS :

```bash
export RESTORE_MONGO_URI="<URI_MONGODB_ATLAS>"
export RESTORE_DATABASE="lulu_shop_restore_20260730"
export RESTORE_CONFIRMATION="RESTORE-$RESTORE_DATABASE"
```

Utilise un compte MongoDB autorise a creer des collections et des index dans
la base cible.

## Etape 4 - Restaurer

Depuis `backend-lulu` :

```powershell
pnpm --filter backend-lulu restore:backup -- "C:\Sauvegardes\tata-lulu-shop-mongodb-extrait" apply
```

Le message attendu est :

```text
Restauration terminee et controlee.
```

L'outil :

1. valide toute l'archive avant la connexion ;
2. verifie que la base cible est vide ;
3. cree les collections ;
4. insere les documents en lots ;
5. recree les index ;
6. recompte les documents et compare les noms d'index.

## Etape 5 - Verifier avant bascule

Dans MongoDB Atlas, ouvre **Explorateur de donnees** puis la base cible :

1. compare le nombre de collections avec le resume de restauration ;
2. verifie que `products`, `orders`, `stores` et `auditevents` sont presents ;
3. verifie que `productImages.files` et `productImages.chunks` sont presents ;
4. lance temporairement une instance du backend sur cette base ;
5. ouvre l'accueil, le catalogue et plusieurs fiches produit ;
6. controle les images, le panier et la connexion admin ;
7. controle les produits, commandes, stocks et journaux dans le backoffice.

Ne modifie `MONGO_URI` sur le backend Render qu'apres ces controles. Le
frontend Vercel ne doit jamais posseder cette variable.

## Etape 6 - Nettoyer la session

PowerShell :

```powershell
Remove-Item Env:RESTORE_MONGO_URI
Remove-Item Env:RESTORE_DATABASE
Remove-Item Env:RESTORE_CONFIRMATION
```

Linux ou macOS :

```bash
unset RESTORE_MONGO_URI RESTORE_DATABASE RESTORE_CONFIRMATION
```

## Frequence recommandee

- Telecharger une archive MongoDB apres une modification importante du
  catalogue.
- Effectuer au minimum une sauvegarde hebdomadaire lorsque la boutique recoit
  des commandes.
- Conserver plusieurs generations dans un stockage prive distinct de Render et
  MongoDB Atlas.
- Refaire un test de restauration apres toute modification du format de
  sauvegarde.
