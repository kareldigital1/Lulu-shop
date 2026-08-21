"use client";

import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  PackageSearch,
  RefreshCw,
  RotateCcw,
  Search,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  STOCK_MOVEMENT_REASONS,
  type StockMovementFilters,
  type StockMovementPage,
  type StockMovementReason,
} from "@/core/domain/models/stock-movement";
import { CLOTHING_SIZE_LABELS } from "@/core/domain/models/product";
import { getApiErrorMessage } from "@/core/infrastructure/http/request-manager";
import { fetchAdminStockMovements } from "@/services/stock-movement.service";
import { Button } from "../ui/button";

type AdminStockMovementsPanelProps = {
  token: string;
};

const REASON_LABELS: Record<StockMovementReason, string> = {
  product_created: "Stock initial",
  product_deleted: "Produit supprimé",
  order_confirmed: "Commande confirmée",
  order_cancelled: "Commande annulée",
  manual_correction: "Correction manuelle",
  restock: "Réapprovisionnement",
};

const EMPTY_PAGE: StockMovementPage = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 1,
};

function formatMovementDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getMovementTone(difference: number) {
  return difference > 0 ? "increase" : "decrease";
}

export function AdminStockMovementsPanel({
  token,
}: AdminStockMovementsPanelProps) {
  const [draftFilters, setDraftFilters] = useState<StockMovementFilters>({
    search: "",
    reason: "",
    dateFrom: "",
    dateTo: "",
  });
  const [filters, setFilters] = useState<StockMovementFilters>({
    search: "",
    reason: "",
    dateFrom: "",
    dateTo: "",
  });
  const [result, setResult] = useState<StockMovementPage>(EMPTY_PAGE);
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCurrent = true;

    async function loadMovements() {
      setIsLoading(true);
      setError("");

      try {
        const nextResult = await fetchAdminStockMovements(
          { ...filters, page, pageSize: 20 },
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
              "Impossible de charger l’historique du stock pour le moment. Veuillez réessayer.",
            ),
          );
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    void loadMovements();

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
    const emptyFilters: StockMovementFilters = {
      search: "",
      reason: "",
      dateFrom: "",
      dateTo: "",
    };
    setDraftFilters(emptyFilters);
    setFilters(emptyFilters);
    setPage(1);
  }

  return (
    <section className="admin-ui-card admin-stock-history">
      <header className="admin-stock-history-head">
        <div>
          <span className="admin-ui-kicker">Inventaire</span>
          <h2>Historique du stock</h2>
          <p>
            {result.total} mouvement{result.total > 1 ? "s" : ""} enregistré
            {result.total > 1 ? "s" : ""}
          </p>
        </div>
        <button
          type="button"
          className="admin-stock-history-refresh"
          aria-label="Actualiser l’historique"
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

      <form className="admin-stock-history-filters" onSubmit={applyFilters}>
        <label className="admin-stock-history-search">
          <span>Rechercher</span>
          <div>
            <Search size={15} strokeWidth={2} aria-hidden="true" />
            <input
              type="search"
              placeholder="Produit, couleur, taille, commande..."
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
          <span>Motif</span>
          <select
            value={draftFilters.reason}
            onChange={(event) =>
              setDraftFilters((current) => ({
                ...current,
                reason: event.target.value as StockMovementReason | "",
              }))
            }
          >
            <option value="">Tous les mouvements</option>
            {STOCK_MOVEMENT_REASONS.map((reason) => (
              <option value={reason} key={reason}>
                {REASON_LABELS[reason]}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Du</span>
          <div className="admin-stock-history-date">
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
          <div className="admin-stock-history-date">
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

        <div className="admin-stock-history-filter-actions">
          <Button type="submit" size="sm" loading={isLoading}>
            Filtrer
          </Button>
          <button
            type="button"
            className="admin-stock-history-reset"
            onClick={resetFilters}
          >
            <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
            Réinitialiser
          </button>
        </div>
      </form>

      {error ? (
        <p className="admin-error admin-stock-history-notice">{error}</p>
      ) : null}

      <div className="admin-stock-history-table-head" aria-hidden="true">
        <span>Produit, couleur et taille</span>
        <span>Mouvement</span>
        <span>Motif</span>
        <span>Commande</span>
        <span>Date et heure</span>
      </div>

      <div className="admin-stock-history-list" aria-busy={isLoading}>
        {isLoading && result.items.length === 0 ? (
          <div className="admin-stock-history-empty">
            <span className="admin-ui-session-loader" aria-hidden="true" />
            <p>Chargement de l’historique...</p>
          </div>
        ) : null}

        {!isLoading && result.items.length === 0 ? (
          <div className="admin-stock-history-empty">
            <PackageSearch size={24} strokeWidth={1.6} aria-hidden="true" />
            <strong>Aucun mouvement trouvé</strong>
            <p>Les prochaines variations de stock apparaîtront ici.</p>
          </div>
        ) : null}

        {result.items.map((movement) => {
          const tone = getMovementTone(movement.difference);

          return (
            <article className="admin-stock-history-row" key={movement._id}>
              <div className="admin-stock-history-product">
                <span className={`admin-stock-history-icon ${tone}`}>
                  {movement.difference > 0 ? (
                    <ArrowUp size={15} strokeWidth={2} aria-hidden="true" />
                  ) : (
                    <ArrowDown size={15} strokeWidth={2} aria-hidden="true" />
                  )}
                </span>
                <div>
                  <strong>{movement.productName}</strong>
                  <small>
                    {movement.colorName} · {CLOTHING_SIZE_LABELS[movement.size]}
                  </small>
                  {movement.note ? <small>{movement.note}</small> : null}
                </div>
              </div>

              <div className="admin-stock-history-quantity">
                <span>{movement.quantityBefore}</span>
                <ArrowRight size={13} strokeWidth={2} aria-hidden="true" />
                <strong>{movement.quantityAfter}</strong>
                <em className={tone}>
                  {movement.difference > 0 ? "+" : ""}
                  {movement.difference}
                </em>
              </div>

              <span className={`admin-stock-history-reason ${tone}`}>
                {REASON_LABELS[movement.reason]}
              </span>

              <span className="admin-stock-history-order">
                {movement.orderReference || "—"}
              </span>

              <time dateTime={movement.createdAt}>
                {formatMovementDate(movement.createdAt)}
              </time>
            </article>
          );
        })}
      </div>

      {result.totalPages > 1 ? (
        <footer className="admin-stock-history-pagination">
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
