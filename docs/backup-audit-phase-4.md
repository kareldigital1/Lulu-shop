# Audit des sauvegardes - Phase 4

Date : 30 juillet 2026

## Perimetre

- Export JSON
- Export MongoDB Canonical Extended JSON
- Index MongoDB
- Images GridFS
- Validation des archives
- Restauration dans une base isolee
- Procedure de reprise

## Etat trouve

### Deja en place

- Le backoffice propose deux telechargements reserves a l'administratrice.
- Les routes sont protegees par JWT et par un limiteur de debit dedie.
- L'export JSON contient les collections applicatives et les metadonnees
  GridFS, en excluant volontairement les blocs binaires.
- L'archive MongoDB contient toutes les collections, les blocs GridFS, les
  definitions d'index, un manifeste et un guide.
- Les documents de l'archive MongoDB utilisent le Canonical Extended JSON.
- Chaque export reussi est inscrit dans le journal d'activite.
- L'interface avertit que les archives contiennent des donnees sensibles.

### Manques confirmes

- Aucun outil ne restaurait l'archive complete.
- Le guide proposait seulement un `mongoimport` d'une collection.
- La recreation des index restait manuelle.
- Aucun controle ne detectait un fichier absent, un compte incorrect ou un
  bloc GridFS orphelin.
- Aucune restauration n'avait ete executee et comparee sur une base Atlas
  isolee.
- La documentation ne definissait pas de procedure de bascule et de retour.

## Modifications realisees

- Ajout de `npm run restore:backup` en mode validation sans ecriture par
  defaut.
- Validation du format, de la version, de la date et de la base source.
- Protection contre les chemins d'archive qui sortent du dossier extrait.
- Verification du nombre de documents de chaque collection.
- Verification des noms, cles et doublons d'index.
- Verification des paires GridFS `files/chunks`, des identifiants, des
  sequences de blocs et de la taille binaire totale.
- Restauration disponible uniquement dans une nouvelle base vide.
- Refus explicite de restaurer dans la base source.
- Confirmation obligatoire `RESTORE-<BASE_CIBLE>`.
- Insertion par lots et recreation automatique de tous les index hors `_id_`.
- Controle apres restauration des comptes de documents et des noms d'index.
- Suppression automatique de la base cible neuve si l'operation echoue apres
  le debut des ecritures.
- Ajout d'une procedure de reprise complete dans
  `docs/backup-restore-procedure.md`.

## Verification reelle

Deux exports ont ete telecharges par les routes du backoffice :

| Export | Taille | Resultat |
| --- | ---: | --- |
| JSON lisible | 58 954 octets | JSON valide, 7 collections consultables |
| Archive MongoDB ZIP | 954 003 octets | Archive extraite et validee |

Contenu MongoDB controle :

| Element | Attendu | Restaure |
| --- | ---: | ---: |
| Collections | 8 | 8 |
| Documents | 98 | 98 |
| Index | 36 | 36 |
| Fichiers GridFS | 23 | 23 |
| Blocs GridFS | 23 | 23 |
| Donnees binaires GridFS | 967 796 octets | 967 796 octets |

La restauration a ete effectuee dans une base Atlas temporaire
`tl_restore_20260730_172016`. Les comptes de documents, les noms d'index et les
octets GridFS ont ete compares a l'archive. Tous les controles ont reussi, puis
la base temporaire a ete supprimee.

Garde-fous verifies :

- restauration dans la base source refusee avant connexion ;
- restauration dans une base non vide refusee, collection temoin intacte ;
- archive avec un compte de documents falsifie refusee ;
- base non vide de test supprimee seulement apres verification de son contenu.

## Non-regression

- Build TypeScript backend : reussi.
- Connexion et deconnexion MongoDB Atlas : reussies.
- Controles de securite : reussis.
- Audit GridFS : 0 fichier orphelin, 0 bloc orphelin, 0 reference manquante.
- Controles de monitoring : reussis.
- TypeScript frontend : reussi.
- ESLint frontend : 0 erreur et 10 avertissements preexistants dans
  `button.tsx`.
- Build Next.js de production : reussi.
- Audit npm de production backend et frontend : 0 vulnerabilite connue.
- Routes controlees en HTTP 200 : accueil, catalogue, a propos, fiche produit
  et backoffice.
- Sondes controlees en HTTP 200 : `/api/health` et `/api/ready`.

## Conclusion

L'archive MongoDB produite le 30 juillet 2026 est techniquement restaurable et
a ete restauree avec succes. L'export JSON reste volontairement un format de
consultation et ne doit pas etre presente comme une sauvegarde complete.

## Risques restants

- Les exports sont declenches manuellement : aucune planification automatique
  ni copie hors site n'existe encore.
- L'archive n'est pas chiffree par l'application. Sa protection depend du
  stockage choisi par l'administratrice.
- L'export parcourt les collections successivement et n'est pas un instantane
  transactionnel global. Une forte activite pendant l'export peut produire
  une archive rejetee par le validateur.
- Les comptes et permissions MongoDB Atlas ne font pas partie de l'archive.
- Les options avancees de collection et validateurs MongoDB ne sont pas
  exportes. Le projet actuel n'en utilise pas.
- Un test de restauration doit rester obligatoire apres tout changement de
  version du format ou de structure GridFS.

La phase 5 n'a pas ete commencee.
