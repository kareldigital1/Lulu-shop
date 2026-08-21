"use client";

import {
  CheckCircle2,
  DatabaseBackup,
  Download,
  FileJson,
  Images,
  ShieldAlert,
} from "lucide-react";
import { useState } from "react";
import type { BackupFormat } from "@/core/domain/models/backup";
import { getApiErrorMessage } from "@/core/infrastructure/http/request-manager";
import { downloadAdminBackup } from "@/services/backup.service";
import { Button } from "../ui/button";

type AdminBackupPanelProps = {
  token: string;
};

type CompletedBackup = {
  format: BackupFormat;
  fileName: string;
  date: Date;
};

function saveBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

function formatBackupDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function AdminBackupPanel({ token }: AdminBackupPanelProps) {
  const [downloading, setDownloading] = useState<BackupFormat | null>(null);
  const [completedBackup, setCompletedBackup] =
    useState<CompletedBackup | null>(null);
  const [error, setError] = useState("");

  async function handleDownload(format: BackupFormat) {
    setDownloading(format);
    setError("");

    try {
      const result = await downloadAdminBackup(format, token);
      saveBlob(result.blob, result.fileName);
      setCompletedBackup({
        format,
        fileName: result.fileName,
        date: new Date(),
      });
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "La sauvegarde n’a pas pu être générée pour le moment. Veuillez réessayer.",
        ),
      );
    } finally {
      setDownloading(null);
    }
  }

  return (
    <section className="admin-backup-panel">
      <header className="admin-ui-card admin-backup-intro">
        <div className="admin-backup-intro-icon">
          <DatabaseBackup size={22} strokeWidth={1.8} aria-hidden="true" />
        </div>
        <div>
          <span className="admin-ui-kicker">Protection des données</span>
          <h2>Sauvegarder la boutique</h2>
          <p>
            Télécharge une copie locale avant une modification importante ou
            un déploiement.
          </p>
        </div>
      </header>

      <div className="admin-backup-options">
        <article className="admin-ui-card admin-backup-card">
          <span className="admin-backup-card-icon json">
            <FileJson size={21} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div className="admin-backup-card-copy">
            <span className="admin-backup-card-label">Consultation rapide</span>
            <h3>Export des données</h3>
            <p>
              Données lisibles des produits, commandes, stocks, contacts et
              activités.
            </p>
            <ul>
              <li>
                <CheckCircle2 size={14} aria-hidden="true" />
                Facile à ouvrir et contrôler
              </li>
              <li>
                <CheckCircle2 size={14} aria-hidden="true" />
                Informations des images incluses
              </li>
              <li>
                <Images size={14} aria-hidden="true" />
                Fichiers binaires des images exclus
              </li>
            </ul>
          </div>
          <Button
            type="button"
            variant="outline"
            loading={downloading === "json"}
            disabled={downloading !== null}
            onClick={() => void handleDownload("json")}
          >
            <Download size={15} aria-hidden="true" />
            Télécharger le JSON
          </Button>
        </article>

        <article className="admin-ui-card admin-backup-card featured">
          <span className="admin-backup-recommended">Sauvegarde complète</span>
          <span className="admin-backup-card-icon mongodb">
            <DatabaseBackup size={21} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <div className="admin-backup-card-copy">
            <span className="admin-backup-card-label">Restauration complète</span>
            <h3>Archive complète</h3>
            <p>
              Copie fidèle des données et des images, prête pour une
              restauration contrôlée par le développeur.
            </p>
            <ul>
              <li>
                <CheckCircle2 size={14} aria-hidden="true" />
                Données et dates conservées
              </li>
              <li>
                <CheckCircle2 size={14} aria-hidden="true" />
                Images originales incluses
              </li>
              <li>
                <CheckCircle2 size={14} aria-hidden="true" />
                Guide de restauration dans l’archive
              </li>
            </ul>
          </div>
          <Button
            type="button"
            loading={downloading === "mongodb"}
            disabled={downloading !== null}
            onClick={() => void handleDownload("mongodb")}
          >
            <Download size={15} aria-hidden="true" />
            Télécharger l’archive
          </Button>
        </article>
      </div>

      {completedBackup ? (
        <p className="admin-backup-success" role="status">
          <CheckCircle2 size={16} aria-hidden="true" />
          {completedBackup.format === "mongodb" ? "Archive complète" : "Export des données"}{" "}
          téléchargé le {formatBackupDate(completedBackup.date)} :{" "}
          <strong>{completedBackup.fileName}</strong>
        </p>
      ) : null}

      {error ? (
        <p className="admin-backup-error" role="alert">
          {error}
        </p>
      ) : null}

      <aside className="admin-ui-card admin-backup-security">
        <ShieldAlert size={19} strokeWidth={1.8} aria-hidden="true" />
        <div>
          <strong>Fichier confidentiel</strong>
          <p>
            La sauvegarde contient les coordonnées des clientes. Conserve-la
            dans un espace privé et ne l’envoie jamais par messagerie publique.
          </p>
        </div>
      </aside>
    </section>
  );
}
