"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  History,
  LogIn,
  LogOut,
  Package,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingBag,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  AUDIT_ACTIONS,
  type AuditAction,
  type AuditEventFilters,
  type AuditEventPage,
} from "@/core/domain/models/audit-event";
import { getApiErrorMessage } from "@/core/infrastructure/http/request-manager";
import { fetchAdminAuditEvents } from "@/services/audit.service";
import { Button } from "../ui/button";

type AdminAuditPanelProps = {
  token: string;
};

const ACTION_LABELS: Record<AuditAction, string> = {
  "auth.login": "Connexion",
  "auth.logout": "Déconnexion",
  "backup.json_exported": "Export JSON",
  "backup.mongodb_exported": "Archive complète",
  "product.created": "Produit créé",
  "product.updated": "Produit modifié",
  "product.deleted": "Produit supprimé",
  "product.hidden": "Produit masqué",
  "product.shown": "Produit affiché",
  "product.price_changed": "Prix modifié",
  "product.promotion_changed": "Promotion modifiée",
  "product.stock_changed": "Stock modifié",
  "order.created": "Commande créée",
  "order.updated": "Commande modifiée",
  "order.confirmed": "Commande confirmée",
  "order.document_generated": "Bon de commande généré",
  "order.document_downloaded": "Bon de commande téléchargé",
  "order.cancelled": "Commande annulée",
  "order.completed": "Commande terminée",
  "order.expired": "Commande expirée",
};

const EMPTY_PAGE: AuditEventPage = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 1,
};

function formatAuditDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function getActionTone(action: AuditAction) {
  if (
    action.includes("deleted") ||
    action.includes("cancelled") ||
    action.includes("expired")
  ) {
    return "danger";
  }

  if (
    action.includes("created") ||
    action.includes("confirmed") ||
    action.includes("completed") ||
    action.includes("exported") ||
    action.includes("login")
  ) {
    return "success";
  }

  if (
    action.includes("hidden") ||
    action.includes("price_changed") ||
    action.includes("stock_changed")
  ) {
    return "warning";
  }

  return "neutral";
}

function AuditIcon({ action }: { action: AuditAction }) {
  if (action === "auth.login") {
    return <LogIn size={16} strokeWidth={1.9} aria-hidden="true" />;
  }

  if (action === "auth.logout") {
    return <LogOut size={16} strokeWidth={1.9} aria-hidden="true" />;
  }

  if (action.startsWith("order.")) {
    return <ShoppingBag size={16} strokeWidth={1.9} aria-hidden="true" />;
  }

  return <Package size={16} strokeWidth={1.9} aria-hidden="true" />;
}

export function AdminAuditPanel({ token }: AdminAuditPanelProps) {
  const [draftFilters, setDraftFilters] = useState<AuditEventFilters>({
    search: "",
    action: "",
    dateFrom: "",
    dateTo: "",
  });
  const [filters, setFilters] = useState<AuditEventFilters>({
    search: "",
    action: "",
    dateFrom: "",
    dateTo: "",
  });
  const [result, setResult] = useState<AuditEventPage>(EMPTY_PAGE);
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCurrent = true;

    async function loadAuditEvents() {
      setIsLoading(true);
      setError("");

      try {
        const nextResult = await fetchAdminAuditEvents(
          {
            ...filters,
            page,
            pageSize: 20,
          },
          token,
        );

        if (isCurrent) {
          setResult(nextResult);
        }
      } catch (requestError) {
        if (isCurrent) {
          setError(
            getApiErrorMessage(
              requestError,
              "Impossible de charger le journal pour le moment. Veuillez réessayer.",
            ),
          );
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    void loadAuditEvents();

    return () => {
      isCurrent = false;
    };
  }, [filters, page, refreshKey, token]);

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setFilters(draftFilters);
  }

  function resetFilters() {
    const emptyFilters: AuditEventFilters = {
      search: "",
      action: "",
      dateFrom: "",
      dateTo: "",
    };
    setDraftFilters(emptyFilters);
    setFilters(emptyFilters);
    setPage(1);
  }

  return (
    <section className="admin-ui-card admin-audit-panel">
      <header className="admin-audit-head">
        <div>
          <span className="admin-ui-kicker">Traçabilité</span>
          <h2>Journal d’activité</h2>
          <p>
            {result.total} événement{result.total > 1 ? "s" : ""} enregistré
            {result.total > 1 ? "s" : ""}
          </p>
        </div>
        <button
          type="button"
          className="admin-audit-refresh"
          aria-label="Actualiser le journal"
          title="Actualiser"
          disabled={isLoading}
          onClick={() => setRefreshKey((current) => current + 1)}
        >
          <RefreshCw
            size={16}
            strokeWidth={2}
            className={isLoading ? "is-spinning" : undefined}
            aria-hidden="true"
          />
        </button>
      </header>

      <form className="admin-audit-filters" onSubmit={applyFilters}>
        <label className="admin-audit-search">
          <span>Rechercher</span>
          <div>
            <Search size={15} strokeWidth={2} aria-hidden="true" />
            <input
              type="search"
              placeholder="Produit, commande, référence..."
              value={draftFilters.search}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
            />
          </div>
        </label>

        <label>
          <span>Action</span>
          <select
            value={draftFilters.action}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                action: event.target.value as AuditAction | "",
              }))
            }
          >
            <option value="">Toutes les actions</option>
            {AUDIT_ACTIONS.map((action) => (
              <option value={action} key={action}>
                {ACTION_LABELS[action]}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Du</span>
          <div className="admin-audit-date">
            <CalendarDays size={14} strokeWidth={2} aria-hidden="true" />
            <input
              type="date"
              value={draftFilters.dateFrom}
              max={draftFilters.dateTo || undefined}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  dateFrom: event.target.value,
                }))
              }
            />
          </div>
        </label>

        <label>
          <span>Au</span>
          <div className="admin-audit-date">
            <CalendarDays size={14} strokeWidth={2} aria-hidden="true" />
            <input
              type="date"
              value={draftFilters.dateTo}
              min={draftFilters.dateFrom || undefined}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  dateTo: event.target.value,
                }))
              }
            />
          </div>
        </label>

        <div className="admin-audit-filter-actions">
          <Button type="submit" size="sm" loading={isLoading}>
            Filtrer
          </Button>
          <button
            type="button"
            className="admin-audit-reset"
            onClick={resetFilters}
          >
            <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
            Réinitialiser
          </button>
        </div>
      </form>

      {error ? <p className="admin-error admin-audit-notice">{error}</p> : null}

      <div className="admin-audit-table-head" aria-hidden="true">
        <span>Événement</span>
        <span>Auteur</span>
        <span>Date et heure</span>
      </div>

      <div className="admin-audit-list" aria-busy={isLoading}>
        {isLoading && result.items.length === 0 ? (
          <div className="admin-audit-empty">
            <span className="admin-ui-session-loader" aria-hidden="true" />
            <p>Chargement du journal...</p>
          </div>
        ) : null}

        {!isLoading && result.items.length === 0 ? (
          <div className="admin-audit-empty">
            <History size={24} strokeWidth={1.6} aria-hidden="true" />
            <strong>Aucun événement trouvé</strong>
            <p>Modifie les filtres ou réalise une action dans le backoffice.</p>
          </div>
        ) : null}

        {result.items.map((event) => (
          <article className="admin-audit-row" key={event._id}>
            <div className="admin-audit-event">
              <span
                className={`admin-audit-event-icon ${getActionTone(event.action)}`}
              >
                <AuditIcon action={event.action} />
              </span>
              <div>
                <span className={`admin-audit-action ${getActionTone(event.action)}`}>
                  {ACTION_LABELS[event.action]}
                </span>
                <strong>{event.summary}</strong>
                <small>{event.resourceLabel}</small>
              </div>
            </div>

            <span className={`admin-audit-actor ${event.actor}`}>
              {event.actor === "admin"
                ? "Administrateur"
                : event.actor === "customer"
                  ? "Cliente"
                  : "Système"}
            </span>

            <time dateTime={event.createdAt}>
              {formatAuditDate(event.createdAt)}
            </time>

          </article>
        ))}
      </div>

      {result.totalPages > 1 ? (
        <footer className="admin-audit-pagination">
          <span>
            Page {result.page} sur {result.totalPages}
          </span>
          <div>
            <button
              type="button"
              aria-label="Page précédente"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Page suivante"
              disabled={page >= result.totalPages || isLoading}
              onClick={() =>
                setPage((current) => Math.min(result.totalPages, current + 1))
              }
            >
              <ChevronRight size={15} aria-hidden="true" />
            </button>
          </div>
        </footer>
      ) : null}
    </section>
  );
}
