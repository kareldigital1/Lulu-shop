# Audit du monitoring - Phase 3

Date : 30 juillet 2026

## Perimetre

- Logs Pino
- Gestion des erreurs serveur
- Logs des appels API
- Logs MongoDB
- Logs d'authentification
- Sonde de vie
- Sonde de disponibilite

## Etat trouve

### Deja en place

- Pino produit des logs JSON structures sur la sortie standard.
- Les logs contiennent le service, l'environnement, le PID et une date ISO.
- Les champs sensibles et les URI MongoDB sont expurges avant journalisation.
- Chaque requete recoit un `X-Request-Id`, fourni par le client ou genere par le serveur.
- Les requetes critiques, les erreurs HTTP et les interruptions clientes sont journalisees.
- Les erreurs JSON, Multer, applicatives et inattendues sont gerees sans exposer leur detail au client.
- Les exceptions non interceptees et les promesses rejetees sont journalisees au niveau fatal.
- Les connexions et deconnexions admin reussies sont conservees dans la collection d'audit.
- `/api/health` existait deja comme sonde de vie.

### Manques confirmes

- Aucune sonde ne verifiait que MongoDB etait reellement disponible.
- `/api/health` pouvait rester vert avec une base de donnees deconnectee.
- Seule la premiere connexion MongoDB etait journalisee.
- Les deconnexions, reconnexions et erreurs MongoDB n'avaient pas d'evenement dedie.
- Les tentatives de connexion admin refusees n'avaient pas d'evenement `auth.*`.
- Les lectures API reussies etaient journalisees en `debug` et disparaissaient avec le niveau `info` utilise par defaut.

## Modifications realisees

- `/api/health` reste une sonde de vie du processus et renvoie `alive` en HTTP 200.
- `/api/ready` execute un vrai `ping` MongoDB avec un delai maximal de 2 secondes.
- `/api/ready` renvoie HTTP 200 avec `ready` lorsque MongoDB repond.
- `/api/ready` renvoie HTTP 503 avec `not_ready` lorsque MongoDB est deconnecte ou indisponible.
- Les deux sondes utilisent `Cache-Control: no-store`.
- Les evenements MongoDB `connecting`, `connected`, `reconnected`, `disconnected` et `error` sont journalises.
- Une fermeture volontaire de MongoDB est distinguee d'une interruption inattendue.
- Les evenements `auth.login_succeeded`, `auth.login_failed`, `auth.logout_succeeded` et `auth.logout_failed` sont disponibles.
- Les logs d'authentification incluent le request ID, le statut, l'IP et le user-agent, jamais les identifiants.
- Les lectures API metier reussies passent au niveau `info`.
- Les sondes et images, trop frequentes, restent au niveau `debug`.
- Une indisponibilite normale de readiness est journalisee en avertissement et non en erreur fatale.
- `npm run check:monitoring` reproduit les controles de monitoring.

## Contrat des sondes

### GET /api/health

- Usage : verifier que le processus Node.js repond.
- Succes : HTTP 200.
- Dependances : aucune.

### GET /api/ready

- Usage : verifier que l'API peut traiter une requete necessitant MongoDB.
- Succes : HTTP 200.
- Indisponible : HTTP 503.
- Dependances : connexion Mongoose et commande MongoDB `ping`.

Pour Render, `/api/ready` est le chemin recommande pour le health check du service.

## Verifications

- Build TypeScript backend : reussi.
- Test de monitoring : reussi.
- Readiness avant connexion MongoDB : HTTP 503.
- Readiness apres connexion MongoDB : HTTP 200.
- Readiness apres deconnexion MongoDB : HTTP 503.
- Transmission d'un `X-Request-Id` valide : reussie.
- Evenement d'echec d'authentification : detecte.
- Evenements de connexion et deconnexion MongoDB : detectes.
- Log d'une lecture API reussie : detecte.
- Connexion Atlas : reussie.
- Controles de securite : reussis.
- Audit GridFS : 0 fichier orphelin, 0 chunk orphelin, 0 reference manquante.
- TypeScript frontend : reussi.
- ESLint frontend : 0 erreur et 10 avertissements preexistants dans `button.tsx`.
- Build Next.js de production : reussi.
- Parcours controles : accueil, catalogue, fiche produit, panier, WhatsApp et backoffice.

## Risques restants

- Les logs sont envoyes uniquement sur la sortie standard. Leur retention et leur recherche dependent donc de Render.
- Aucun service externe de collecte ou d'alerte comme Grafana, Datadog ou Sentry n'a ete ajoute, car cette phase ne justifie pas une nouvelle dependance ou un cout.
- Le serveur gere les erreurs fatales, mais l'arret gracieux sur `SIGTERM` reste un sujet de fiabilite distinct a traiter seulement si un besoin de zero interruption est confirme.
- Les logs d'IP et de user-agent doivent conserver une duree de retention raisonnable car ils peuvent constituer des donnees techniques personnelles.
