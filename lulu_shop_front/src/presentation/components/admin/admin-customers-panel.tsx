"use client";

import {
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  ShoppingBag,
  UserRound,
  Users,
  WalletCards,
} from "lucide-react";
import { useEffect, useState } from "react";
import type {
  CustomerDetails,
  CustomerPage,
  CustomerSort,
} from "@/core/domain/models/customer";
import type { Order, OrderStatus } from "@/core/domain/models/order";
import { getApiErrorMessage } from "@/core/infrastructure/http/request-manager";
import {
  fetchAdminCustomerDetails,
  fetchAdminCustomers,
} from "@/services/customer.service";

type AdminCustomersPanelProps = {
  token: string;
  focusCustomerCode?: string;
  onOpenOrder: (reference: string) => void;
};

const EMPTY_PAGE: CustomerPage = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 12,
  totalPages: 1,
};

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  cancelled: "Annulée",
  completed: "Terminée",
  expired: "Expirée",
};

function formatMoney(value: number) {
  return `${value.toLocaleString("fr-FR")} FCFA`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getOrderTotal(order: Order) {
  return order.items.reduce(
    (total, item) => total + (item.unitPrice ?? 0) * item.quantity,
    0,
  );
}

function getOrderQuantity(order: Order) {
  return order.items.reduce((total, item) => total + item.quantity, 0);
}

export function AdminCustomersPanel({
  token,
  focusCustomerCode = "",
  onOpenOrder,
}: AdminCustomersPanelProps) {
  const [result, setResult] = useState<CustomerPage>(EMPTY_PAGE);
  const [details, setDetails] = useState<CustomerDetails | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [draftSearch, setDraftSearch] = useState(focusCustomerCode);
  const [search, setSearch] = useState(focusCustomerCode);
  const [sort, setSort] = useState<CustomerSort>("recent");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCurrent = true;

    async function loadCustomers() {
      setIsLoading(true);
      setError("");

      try {
        const nextResult = await fetchAdminCustomers(
          { search, sort, page, pageSize: 12 },
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
              "Impossible de charger les clientes.",
            ),
          );
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    void loadCustomers();

    return () => {
      isCurrent = false;
    };
  }, [page, refreshKey, search, sort, token]);

  const effectiveCustomerId =
    result.items.find((customer) => customer._id === selectedCustomerId)?._id ??
    result.items[0]?._id ??
    "";

  useEffect(() => {
    let isCurrent = true;

    if (!effectiveCustomerId) {
      return () => {
        isCurrent = false;
      };
    }

    async function loadDetails() {
      setIsLoadingDetails(true);
      setError("");

      try {
        const nextDetails = await fetchAdminCustomerDetails(
          effectiveCustomerId,
          token,
        );

        if (isCurrent) {
          setDetails(nextDetails);
        }
      } catch (requestError) {
        if (isCurrent) {
          setError(
            getApiErrorMessage(
              requestError,
              "Impossible de charger l'historique de cette cliente.",
            ),
          );
        }
      } finally {
        if (isCurrent) {
          setIsLoadingDetails(false);
        }
      }
    }

    void loadDetails();

    return () => {
      isCurrent = false;
    };
  }, [effectiveCustomerId, token]);
  const visibleDetails =
    details?.customer._id === effectiveCustomerId ? details : null;

  function applySearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSelectedCustomerId("");
    setSearch(draftSearch.trim());
  }

  function resetSearch() {
    setDraftSearch("");
    setSearch("");
    setPage(1);
    setSelectedCustomerId("");
  }

  function changePage(nextPage: number) {
    setPage(nextPage);
    setSelectedCustomerId("");
  }

  return (
    <section className="admin-customers-layout">
      <aside className="admin-ui-card admin-customers-list">
        <header className="admin-customers-list-head">
          <div>
            <span className="admin-ui-kicker">Relation boutique</span>
            <h2>
              {result.total} cliente{result.total > 1 ? "s" : ""}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Actualiser les clientes"
            title="Actualiser"
            disabled={isLoading}
            onClick={() => setRefreshKey((current) => current + 1)}
          >
            <RefreshCw
              size={15}
              className={isLoading ? "is-spinning" : undefined}
              aria-hidden="true"
            />
          </button>
        </header>

        <form className="admin-customers-search" onSubmit={applySearch}>
          <label>
            <span className="sr-only">Rechercher une cliente</span>
            <Search size={14} aria-hidden="true" />
            <input
              type="search"
              placeholder="Nom, téléphone, code ou commande..."
              value={draftSearch}
              onChange={(event) => setDraftSearch(event.target.value)}
            />
          </label>
          <button type="submit">Rechercher</button>
        </form>

        <label className="admin-customers-sort">
          <span className="sr-only">Trier les clientes</span>
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as CustomerSort);
              setPage(1);
              setSelectedCustomerId("");
            }}
          >
            <option value="recent">Dernière commande</option>
            <option value="spent-desc">Total dépensé</option>
            <option value="orders-desc">Nombre de commandes</option>
            <option value="name-asc">Nom : A à Z</option>
          </select>
          <ChevronDown size={14} aria-hidden="true" />
        </label>

        {search ? (
          <button
            type="button"
            className="admin-customers-reset"
            onClick={resetSearch}
          >
            Effacer la recherche
          </button>
        ) : null}

        {error ? <p className="admin-error admin-customers-notice">{error}</p> : null}

        <div className="admin-customers-list-scroll" aria-busy={isLoading}>
          {result.items.map((customer) => (
            <button
              type="button"
              className={`admin-customer-list-item ${
                effectiveCustomerId === customer._id ? "active" : ""
              }`}
              key={customer._id}
              onClick={() => {
                setSelectedCustomerId(customer._id);
              }}
            >
              <span className="admin-customer-avatar" aria-hidden="true">
                {customer.name.slice(0, 1).toLocaleUpperCase("fr")}
              </span>
              <span className="admin-customer-list-copy">
                <strong>{customer.name}</strong>
                <span>
                  {customer.customerCode} · {customer.phone}
                </span>
                <small>
                  {customer.orderCount} commande
                  {customer.orderCount > 1 ? "s" : ""} ·{" "}
                  {formatMoney(customer.totalSpent)}
                </small>
              </span>
            </button>
          ))}

          {!isLoading && result.items.length === 0 ? (
            <div className="admin-customers-empty-list">
              <Users size={22} aria-hidden="true" />
              <strong>Aucune cliente trouvée</strong>
              <span>Modifie la recherche pour afficher d’autres profils.</span>
            </div>
          ) : null}
        </div>

        {result.totalPages > 1 ? (
          <footer className="admin-list-pagination admin-customers-pagination">
            <span>
              Page {result.page} sur {result.totalPages}
            </span>
            <div>
              <button
                type="button"
                aria-label="Page précédente des clientes"
                disabled={page <= 1 || isLoading}
                onClick={() => changePage(Math.max(1, page - 1))}
              >
                <ChevronLeft size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Page suivante des clientes"
                disabled={page >= result.totalPages || isLoading}
                onClick={() =>
                  changePage(Math.min(result.totalPages, page + 1))
                }
              >
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            </div>
          </footer>
        ) : null}
      </aside>

      {visibleDetails ? (
        <article className="admin-ui-card admin-customer-details">
          <header className="admin-customer-profile">
            <span className="admin-customer-profile-avatar" aria-hidden="true">
              {visibleDetails.customer.name.slice(0, 1).toLocaleUpperCase("fr")}
            </span>
            <div>
              <span className="admin-ui-kicker">Profil cliente</span>
              <h2>{visibleDetails.customer.name}</h2>
              <p>
                {visibleDetails.customer.customerCode} · Cliente depuis le{" "}
                {formatDate(visibleDetails.customer.createdAt)}
              </p>
            </div>
            <a
              href={`https://wa.me/${visibleDetails.customer.normalizedPhone}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={15} aria-hidden="true" />
              WhatsApp
            </a>
          </header>

          <div className="admin-customer-contact">
            <Phone size={15} aria-hidden="true" />
            <span>{visibleDetails.customer.phone}</span>
          </div>

          <div className="admin-customer-metrics">
            <div>
              <span className="admin-customer-metric-icon orders">
                <ShoppingBag size={17} aria-hidden="true" />
              </span>
              <small>Commandes</small>
              <strong>{visibleDetails.customer.orderCount}</strong>
            </div>
            <div>
              <span className="admin-customer-metric-icon completed">
                <UserRound size={17} aria-hidden="true" />
              </span>
              <small>Terminées</small>
              <strong>{visibleDetails.customer.completedOrderCount}</strong>
            </div>
            <div>
              <span className="admin-customer-metric-icon spent">
                <WalletCards size={17} aria-hidden="true" />
              </span>
              <small>Total dépensé</small>
              <strong>{formatMoney(visibleDetails.customer.totalSpent)}</strong>
            </div>
            <div>
              <span className="admin-customer-metric-icon recent">
                <CalendarDays size={17} aria-hidden="true" />
              </span>
              <small>Dernière commande</small>
              <strong>{formatDate(visibleDetails.customer.lastOrderAt)}</strong>
            </div>
          </div>

          <section className="admin-customer-history">
            <div className="admin-customer-history-head">
              <div>
                <span className="admin-ui-kicker">Historique d’achat</span>
                <h3>Commandes de la cliente</h3>
              </div>
              <span>
                {visibleDetails.orders.length} commande
                {visibleDetails.orders.length > 1 ? "s" : ""}
              </span>
            </div>

            <div className="admin-customer-order-list">
              {visibleDetails.orders.map((order) => (
                <button
                  type="button"
                  className="admin-customer-order"
                  key={order._id}
                  onClick={() => onOpenOrder(order.reference)}
                  aria-label={`Ouvrir la commande ${order.reference}`}
                >
                  <div>
                    <strong>{order.reference}</strong>
                    <span>
                      {getOrderQuantity(order)} article
                      {getOrderQuantity(order) > 1 ? "s" : ""} ·{" "}
                      {formatDate(order.createdAt)}
                    </span>
                  </div>
                  <span className={`admin-order-status ${order.status}`}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </span>
                  <strong className="admin-customer-order-total">
                    {formatMoney(getOrderTotal(order))}
                  </strong>
                  <ArrowUpRight
                    className="admin-customer-order-open-icon"
                    size={15}
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
          </section>
        </article>
      ) : (
        <article
          className="admin-ui-card admin-customer-details-empty"
          aria-busy={isLoadingDetails}
        >
          <Users size={26} aria-hidden="true" />
          <h2>
            {isLoadingDetails
              ? "Chargement du profil..."
              : "Sélectionne une cliente"}
          </h2>
          <p>Son historique et ses indicateurs apparaîtront ici.</p>
        </article>
      )}
    </section>
  );
}
