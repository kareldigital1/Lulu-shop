# Bons de commande PDF

Date de mise en oeuvre : 4 août 2026

## Règle métier

Un bon de commande est créé après confirmation administrative. Il porte un
numéro `BC-AAAAMMJJ-XXXX` indépendant de la référence `TL-*` de la commande.
Ce document ne remplace pas une facture comptable.

La génération intervient après la transaction de confirmation et de stock. Si
le moteur PDF ou GridFS échoue, la commande reste confirmée : le backoffice
affiche alors l'action `Générer le bon`. Cette décision protège le workflow
historique et permet une reprise manuelle.

## Contenu et configuration

Le PDF reprend :

- le logo Tata Lulu Shop ;
- le numéro du bon, la référence, les dates et le statut ;
- le nom et le téléphone de la cliente ;
- les articles, couleurs, quantités, prix unitaires et sous-totaux ;
- le montant total lorsque tous les prix sont connus ;
- les téléphones, WhatsApp, l'adresse et l'e-mail de `stores/main-store`.

Un prix manquant reste `À confirmer`. Le total devient lui aussi
`À confirmer`, car additionner seulement les lignes connues produirait un
montant trompeur.

## Stockage et idempotence

Les fichiers sont conservés dans le bucket GridFS `orderDocuments`. La commande
contient uniquement les métadonnées `purchaseOrder`. Un second appel de
génération renvoie la commande existante sans créer un nouveau fichier.

La séquence journalière est incrémentée atomiquement dans
`orderdocumentsequences`. L'index unique sur `purchaseOrder.number` constitue
une seconde protection contre les doublons.

## WhatsApp

Le bouton `Envoyer le bon` ouvre WhatsApp avec un message prérempli contenant
la référence, le montant et le numéro du bon. Aucun message ni fichier n'est
envoyé automatiquement et aucune API WhatsApp Business n'est utilisée.

## Contrôles

- rendu d'un PDF d'une page avec un prix à confirmer ;
- rendu d'un PDF de trois pages avec répétition des en-têtes et pieds de page ;
- numéros successifs `0001` et `0002` dans une base Atlas temporaire ;
- deux fichiers GridFS pour deux commandes ;
- seconde génération idempotente ;
- téléchargement vérifié par signature `%PDF` et en-têtes HTTP ;
- contrôles commandes, stock et clientes rejoués avec succès.
