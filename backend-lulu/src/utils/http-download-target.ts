/**
 * Contrats minimaux dont les services ont besoin pour diffuser un fichier ou un
 * flux vers la cliente.
 *
 * `express.Response` les satisfait structurellement : les contrôleurs
 * continuent de passer leur `response` sans aucun changement. En dépendant de
 * ces interfaces plutôt que du type `Response`, les services restent
 * indépendants du framework HTTP et deviennent testables avec un simple
 * `PassThrough` auquel on ajoute `setHeader`.
 */
export interface HttpStreamTarget extends NodeJS.WritableStream {
  setHeader(
    name: string,
    value: number | string | readonly string[],
  ): unknown;
}

/**
 * Étend `HttpStreamTarget` pour les téléchargements qui pilotent aussi le code
 * de statut et surveillent la fin d'écriture.
 */
export interface HttpDownloadTarget extends HttpStreamTarget {
  readonly writableFinished: boolean;
  status(code: number): HttpDownloadTarget;
}
