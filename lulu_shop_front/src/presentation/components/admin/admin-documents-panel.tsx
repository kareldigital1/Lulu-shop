"use client";

import {
  Archive,
  ClipboardList,
  DatabaseBackup,
  Download,
  FileJson,
  FileText,
  FolderArchive,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { BackupFormat } from "@/core/domain/models/backup";
import type { Order } from "@/core/domain/models/order";
import { getApiErrorMessage } from "@/core/infrastructure/http/request-manager";
import { downloadAdminBackup } from "@/services/backup.service";
import {
  downloadAdminOrderPurchaseOrder,
  fetchAdminOrders,
} from "@/services/order.service";
import { Button } from "../ui/button";

type AdminDocumentsPanelProps = {
  token: string;
  onOpenOrders: () => void;
  onOpenBackups: () => void;
};

function saveBlob(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1_000);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AdminDocumentsPanel({
  token,
  onOpenOrders,
  onOpenBackups,
}: AdminDocumentsPanelProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadDocuments() {
      setLoading(true);
      setError("");

      try {
        const result = await fetchAdminOrders({ page: 1, pageSize: 50 }, token);
        if (isActive) {
          setOrders(result.items.filter((order) => order.purchaseOrder));
        }
      } catch (requestError) {
        if (isActive) {
          setError(
            getApiErrorMessage(
              requestError,
              "Impossible de charger les bons de commande.",
            ),
          );
        }
      } finally {
        if (isActive) setLoading(false);
      }
    }

    void loadDocuments();
    return () => {
      isActive = false;
    };
  }, [token]);

  async function downloadBackup(format: BackupFormat) {
    setDownloading(format);
    setError("");

    try {
      const result = await downloadAdminBackup(format, token);
      saveBlob(result.blob, result.fileName);
    } catch (requestError) {
      setError(
        getApiErrorMessage(requestError, "Impossible de générer cet export."),
      );
    } finally {
      setDownloading(null);
    }
  }

  async function downloadPurchaseOrder(order: Order) {
    setDownloading(order._id);
    setError("");

    try {
      const result = await downloadAdminOrderPurchaseOrder(order._id, token);
      saveBlob(result.blob, result.fileName);
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "Impossible de télécharger ce bon de commande.",
        ),
      );
    } finally {
      setDownloading(null);
    }
  }

  return (
    <section className="admin-documents-panel">
      <header className="admin-ui-card admin-documents-heading">
        <span className="admin-documents-heading-icon">
          <FolderArchive size={21} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div>
          <span className="admin-ui-kicker">Centre documentaire</span>
          <h2>Documents de la boutique</h2>
          <p>Bons de commande, exports et archives réunis dans un seul espace.</p>
        </div>
      </header>

      <div className="admin-documents-cards">
        <article className="admin-ui-card admin-document-card">
          <span className="admin-document-card-icon"><ClipboardList size={19} aria-hidden="true" /></span>
          <div><strong>Bons de commande PDF</strong><p>{orders.length} document{orders.length > 1 ? "s" : ""} disponible{orders.length > 1 ? "s" : ""}</p></div>
          <Button type="button" size="sm" variant="outline" onClick={onOpenOrders}>Gérer les commandes</Button>
        </article>
        <article className="admin-ui-card admin-document-card">
          <span className="admin-document-card-icon"><FileJson size={19} aria-hidden="true" /></span>
          <div><strong>Export des données</strong><p>Copie lisible des informations de la boutique</p></div>
          <Button type="button" size="sm" variant="outline" loading={downloading === "json"} disabled={downloading !== null} onClick={() => void downloadBackup("json")}><Download size={14} aria-hidden="true" /> Télécharger</Button>
        </article>
        <article className="admin-ui-card admin-document-card">
          <span className="admin-document-card-icon"><DatabaseBackup size={19} aria-hidden="true" /></span>
          <div><strong>Archive complète</strong><p>Données et images prêtes à être restaurées</p></div>
          <Button type="button" size="sm" variant="outline" loading={downloading === "mongodb"} disabled={downloading !== null} onClick={() => void downloadBackup("mongodb")}><Download size={14} aria-hidden="true" /> Télécharger</Button>
        </article>
        <article className="admin-ui-card admin-document-card">
          <span className="admin-document-card-icon"><Archive size={19} aria-hidden="true" /></span>
          <div><strong>Archives</strong><p>Accéder aux sauvegardes détaillées</p></div>
          <Button type="button" size="sm" variant="outline" onClick={onOpenBackups}>Voir les sauvegardes</Button>
        </article>
      </div>

      <section className="admin-ui-card admin-documents-list">
        <div className="admin-ui-card-head">
          <div><span className="admin-ui-kicker">Documents récents</span><h3>Bons de commande générés</h3></div>
        </div>

        {error ? <p className="admin-documents-error" role="alert">{error}</p> : null}
        {loading ? <p className="admin-documents-empty">Chargement des documents...</p> : null}
        {!loading && orders.length === 0 ? (
          <div className="admin-documents-empty"><FileText size={24} aria-hidden="true" /><p>Aucun bon de commande n’a encore été généré.</p><Button type="button" size="sm" variant="outline" onClick={onOpenOrders}>Ouvrir les commandes</Button></div>
        ) : null}

        {!loading && orders.length > 0 ? (
          <div className="admin-documents-table">
            <div className="admin-documents-table-head"><span>Document</span><span>Commande</span><span>Date</span><span>Action</span></div>
            {orders.map((order) => (
              <article className="admin-documents-row" key={order._id}>
                <div><FileText size={17} aria-hidden="true" /><strong>{order.purchaseOrder?.number}</strong></div>
                <span>{order.reference}</span>
                <span>{order.purchaseOrder ? formatDate(order.purchaseOrder.generatedAt) : ""}</span>
                <Button type="button" size="sm" variant="outline" loading={downloading === order._id} disabled={downloading !== null} onClick={() => void downloadPurchaseOrder(order)} aria-label={`Télécharger ${order.purchaseOrder?.number}`}><Download size={14} aria-hidden="true" /> PDF</Button>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </section>
  );
}
