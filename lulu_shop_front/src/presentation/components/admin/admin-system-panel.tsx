"use client";

import {
  Database,
  DatabaseBackup,
  MailCheck,
  RefreshCw,
  Store,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { AdminSystemStatus } from "@/core/domain/models/store";
import { getApiErrorMessage } from "@/core/infrastructure/http/request-manager";
import { fetchAdminSystemStatus } from "@/services/store-settings.service";
import { Button } from "../ui/button";

export function AdminSystemPanel({ token }: { token: string }) {
  const [status, setStatus] = useState<AdminSystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadStatus() {
    setLoading(true);
    setError("");

    try {
      setStatus(await fetchAdminSystemStatus(token));
    } catch (requestError) {
      setError(
        getApiErrorMessage(
          requestError,
          "Impossible de vérifier l’état de la boutique pour le moment.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let isActive = true;

    fetchAdminSystemStatus(token)
      .then((result) => {
        if (isActive) setStatus(result);
      })
      .catch((requestError: unknown) => {
        if (isActive) {
          setError(
            getApiErrorMessage(
              requestError,
              "Impossible de vérifier l’état de la boutique pour le moment.",
            ),
          );
        }
      })
      .finally(() => {
        if (isActive) setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [token]);

  const services = status
    ? [
        { key: "storefront", title: "Boutique", icon: Store, ...status.services.storefront },
        { key: "data", title: "Données", icon: Database, ...status.services.data },
        { key: "emails", title: "E-mails", icon: MailCheck, ...status.services.emails },
        { key: "backups", title: "Sauvegardes", icon: DatabaseBackup, ...status.services.backups },
      ]
    : [];

  return (
    <section className="admin-system-panel">
      <header className="admin-ui-card admin-system-heading">
        <span className="admin-system-heading-icon">
          <Wrench size={20} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div>
          <span className="admin-ui-kicker">Suivi des services</span>
          <h2>État de la boutique</h2>
          <p>
            Vérifie simplement que les fonctions essentielles de la boutique
            sont disponibles.
          </p>
        </div>
      </header>

      <div className="admin-system-toolbar">
        <p>{status ? `Dernière vérification : ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(status.checkedAt))}` : "Diagnostic en attente"}</p>
        <Button type="button" size="sm" variant="outline" loading={loading} onClick={() => void loadStatus()}><RefreshCw size={14} aria-hidden="true" /> Actualiser</Button>
      </div>

      {error ? <p className="admin-system-error" role="alert">{error}</p> : null}

      <div className="admin-system-grid">
        {services.map(({ key, title, icon: Icon, ok, label }) => (
          <article className="admin-ui-card admin-system-card" key={key}>
            <span><Icon size={18} strokeWidth={1.8} aria-hidden="true" /></span>
            <div>
              <strong>{title}</strong>
              <p className={ok ? "is-up" : "is-down"}>{label}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
