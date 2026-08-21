"use client";

import {
  BellRing,
  Boxes,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  RefreshCw,
  ShoppingBag,
  Sun,
  Tags,
  Trophy,
  UserPlus,
  Users,
  Warehouse,
  WalletCards,
} from "lucide-react";
import { useMemo, useState } from "react";
import type {
  AdminDashboardStats,
  DashboardSalesPoint,
} from "@/core/domain/models/dashboard";
import type { AdminNotificationSummary } from "@/core/domain/models/admin-notification";
import type { OrderStatus } from "@/core/domain/models/order";
import { getProductGroup } from "@/lib/product-category-groups";

type AdminDashboardAnalyticsProps = {
  stats: AdminDashboardStats | null;
  notificationSummary: AdminNotificationSummary;
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  onOpenNotifications: () => void;
};

type LineChartPoint = {
  key: string;
  label: string;
  value: number;
};

const ORDER_STATUS_DETAILS: Array<{
  status: OrderStatus;
  label: string;
  color: string;
}> = [
  { status: "pending", label: "En attente", color: "#d7a62b" },
  { status: "confirmed", label: "Confirmées", color: "#315f86" },
  { status: "completed", label: "Terminées", color: "#23865b" },
  { status: "cancelled", label: "Annulées", color: "#c84a5b" },
  { status: "expired", label: "Expirées", color: "#766f65" },
];

function formatCurrency(value: number) {
  return `${new Intl.NumberFormat("fr-FR").format(value).replace(/\u00a0|\u202f/g, " ")} FCFA`;
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("fr-FR").format(value).replace(/\u00a0|\u202f/g, " ");
}

function formatGeneratedAt(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Porto-Novo",
  }).format(new Date(value));
}

function getSeriesSummary(series: DashboardSalesPoint[]) {
  return series.reduce(
    (summary, point) => ({
      orders: summary.orders + point.orders,
      quantity: summary.quantity + point.quantity,
      unpricedQuantity:
        summary.unpricedQuantity + point.unpricedQuantity,
    }),
    { orders: 0, quantity: 0, unpricedQuantity: 0 },
  );
}

function AdminLineChart({
  points,
  label,
  valueFormatter,
}: {
  points: LineChartPoint[];
  label: string;
  valueFormatter: (value: number) => string;
}) {
  const width = 720;
  const height = 230;
  const horizontalPadding = 22;
  const topPadding = 24;
  const bottomPadding = 26;
  const chartBottom = height - bottomPadding;
  const chartHeight = chartBottom - topPadding;
  const actualMaxValue = Math.max(0, ...points.map((point) => point.value));
  const scaleMaxValue = Math.max(1, actualMaxValue);
  const xStep =
    points.length > 1
      ? (width - horizontalPadding * 2) / (points.length - 1)
      : 0;
  const coordinates = points.map((point, index) => ({
    ...point,
    x:
      points.length > 1
        ? horizontalPadding + index * xStep
        : width / 2,
    y: topPadding + (1 - point.value / scaleMaxValue) * chartHeight,
  }));
  const linePath = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath =
    coordinates.length > 0
      ? `M ${coordinates[0].x} ${chartBottom} ${linePath.replace(/^M/, "L")} L ${coordinates.at(-1)?.x ?? horizontalPadding} ${chartBottom} Z`
      : "";
  const labelInterval = Math.max(1, Math.ceil(points.length / 8));
  const visibleLabels = points.filter(
    (_point, index) =>
      index % labelInterval === 0 || index === points.length - 1,
  );

  return (
    <div className="admin-analytics-line-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
        preserveAspectRatio="none"
      >
        {[0, 0.5, 1].map((position) => {
          const y = topPadding + position * chartHeight;
          return (
            <line
              key={position}
              x1={horizontalPadding}
              x2={width - horizontalPadding}
              y1={y}
              y2={y}
              className="admin-analytics-grid-line"
            />
          );
        })}
        {areaPath ? (
          <path d={areaPath} className="admin-analytics-area" />
        ) : null}
        {linePath ? (
          <path d={linePath} className="admin-analytics-line" />
        ) : null}
        {coordinates.map((point) => (
          <circle
            key={point.key}
            cx={point.x}
            cy={point.y}
            r="4"
            className="admin-analytics-point"
          >
            <title>
              {point.label} : {valueFormatter(point.value)}
            </title>
          </circle>
        ))}
        <text
          x={horizontalPadding}
          y={topPadding - 8}
          className="admin-analytics-axis-value"
        >
          {valueFormatter(actualMaxValue)}
        </text>
        <text
          x={horizontalPadding}
          y={chartBottom - 7}
          className="admin-analytics-axis-value"
        >
          0
        </text>
      </svg>
      <div className="admin-analytics-axis-labels">
        {visibleLabels.map((point) => (
          <span key={point.key}>{point.label}</span>
        ))}
      </div>
    </div>
  );
}

export function AdminDashboardAnalytics({
  stats,
  notificationSummary,
  isLoading,
  onRefresh,
  onOpenNotifications,
}: AdminDashboardAnalyticsProps) {
  const [salesPeriod, setSalesPeriod] = useState<"months" | "weeks">(
    "months",
  );
  const groupedCategories = useMemo(() => {
    const totals = new Map<
      string,
      { label: string; revenue: number; quantity: number }
    >();

    stats?.categorySales.forEach((category) => {
      const label = getProductGroup(category.category);
      const current = totals.get(label) ?? {
        label,
        revenue: 0,
        quantity: 0,
      };
      current.revenue += category.revenue;
      current.quantity += category.quantity;
      totals.set(label, current);
    });

    return [...totals.values()]
      .sort(
        (left, right) =>
          right.quantity - left.quantity ||
          right.revenue - left.revenue ||
          left.label.localeCompare(right.label, "fr"),
      )
      .slice(0, 5);
  }, [stats]);

  if (!stats) {
    return (
      <section
        className="admin-ui-card admin-analytics-loading"
        aria-busy={isLoading}
      >
        <span className="admin-ui-session-loader" aria-hidden="true" />
        <strong>
          {isLoading
            ? "Calcul des statistiques..."
            : "Statistiques indisponibles"}
        </strong>
        {!isLoading ? (
          <button type="button" onClick={() => void onRefresh()}>
            Réessayer
          </button>
        ) : null}
      </section>
    );
  }

  const salesSeries =
    salesPeriod === "months" ? stats.monthlySales : stats.weeklySales;
  const salesSummary = getSeriesSummary(salesSeries);
  const orderTotal = Object.values(stats.ordersByStatus).reduce(
    (total, count) => total + count,
    0,
  );
  const statusSegments = ORDER_STATUS_DETAILS.map((entry) => {
    const count = stats.ordersByStatus[entry.status];
    const percentage = orderTotal ? (count / orderTotal) * 100 : 0;
    return { ...entry, count, percentage };
  });
  let currentPercentage = 0;
  const donutGradient = orderTotal
    ? `conic-gradient(${statusSegments
        .map((segment) => {
          const start = currentPercentage;
          currentPercentage += segment.percentage;
          return `${segment.color} ${start}% ${currentPercentage}%`;
        })
        .join(", ")})`
    : "conic-gradient(#ece8e1 0 100%)";
  const maxProductQuantity = Math.max(
    1,
    ...stats.topProducts.map((product) => product.quantity),
  );
  const maxCategoryQuantity = Math.max(
    1,
    ...groupedCategories.map((category) => category.quantity),
  );
  const maxCustomerSpent = Math.max(
    1,
    ...stats.customers.top.map((customer) => customer.totalSpent),
  );

  return (
    <div className="admin-analytics-dashboard">
      <header className="admin-analytics-heading">
        <div>
          <span className="admin-ui-kicker">Vue commerciale</span>
          <h2>Activité réelle de la boutique</h2>
          <p>
            Chiffres calculés sur les commandes terminées. Mis à jour le{" "}
            {formatGeneratedAt(stats.generatedAt)}.
          </p>
        </div>
        <button
          type="button"
          className="admin-analytics-refresh"
          onClick={() => void onRefresh()}
          disabled={isLoading}
        >
          <RefreshCw
            size={15}
            strokeWidth={2}
            aria-hidden="true"
            className={isLoading ? "is-spinning" : ""}
          />
          Actualiser
        </button>
      </header>

      <button
        type="button"
        className="admin-analytics-notification-signal"
        onClick={onOpenNotifications}
      >
        <span>
          <BellRing size={16} strokeWidth={1.9} aria-hidden="true" />
          {notificationSummary.unreadCount > 0 ? (
            <b>{notificationSummary.unreadCount}</b>
          ) : null}
        </span>
        <div className="admin-analytics-notification-copy">
          <strong>Notifications</strong>
          <small>
            {notificationSummary.unreadCount} non lue
            {notificationSummary.unreadCount > 1 ? "s" : ""}
          </small>
          <ul>
            <li>
              {notificationSummary.dashboard.pendingOrders} commande
              {notificationSummary.dashboard.pendingOrders > 1 ? "s" : ""} en attente
            </li>
            <li>
              {notificationSummary.dashboard.lowStockProducts} produit
              {notificationSummary.dashboard.lowStockProducts > 1 ? "s" : ""} en stock faible
            </li>
            <li>
              {notificationSummary.dashboard.expiredOrders} commande
              {notificationSummary.dashboard.expiredOrders > 1 ? "s" : ""} expirée
              {notificationSummary.dashboard.expiredOrders > 1 ? "s" : ""}
            </li>
            <li>
              {notificationSummary.dashboard.newCustomers} nouvelle
              {notificationSummary.dashboard.newCustomers > 1 ? "s" : ""} cliente
              {notificationSummary.dashboard.newCustomers > 1 ? "s" : ""}
            </li>
          </ul>
        </div>
        <ChevronRight size={16} strokeWidth={1.9} aria-hidden="true" />
      </button>

      <div className="admin-analytics-kpis">
        <article className="admin-ui-card admin-analytics-kpi">
          <span className="admin-analytics-kpi-icon burgundy">
            <CircleDollarSign size={18} strokeWidth={1.9} aria-hidden="true" />
          </span>
          <span>Chiffre d’affaires</span>
          <strong>{formatCurrency(stats.revenue.total)}</strong>
          <small>
            {stats.revenue.completedOrders} commande
            {stats.revenue.completedOrders > 1 ? "s" : ""} terminée
            {stats.revenue.completedOrders > 1 ? "s" : ""}
          </small>
        </article>

        <article className="admin-ui-card admin-analytics-kpi">
          <span className="admin-analytics-kpi-icon gold">
            <CalendarDays size={18} strokeWidth={1.9} aria-hidden="true" />
          </span>
          <span>Ce mois</span>
          <strong>{formatCurrency(stats.revenue.month)}</strong>
          <small>Cette semaine : {formatCurrency(stats.revenue.week)}</small>
        </article>

        <article className="admin-ui-card admin-analytics-kpi">
          <span className="admin-analytics-kpi-icon blue">
            <Sun size={18} strokeWidth={1.9} aria-hidden="true" />
          </span>
          <span>Ventes du jour</span>
          <strong>{formatCurrency(stats.revenue.today)}</strong>
          <small>
            {stats.revenue.todayOrders} commande
            {stats.revenue.todayOrders > 1 ? "s" : ""} ·{" "}
            {stats.revenue.todayItems} pièce
            {stats.revenue.todayItems > 1 ? "s" : ""}
          </small>
        </article>

        <article className="admin-ui-card admin-analytics-kpi">
          <span className="admin-analytics-kpi-icon green">
            <Warehouse size={18} strokeWidth={1.9} aria-hidden="true" />
          </span>
          <span>Valeur du stock</span>
          <strong>{formatCurrency(stats.stockValue.amount)}</strong>
          <small>{formatInteger(stats.catalog.totalUnits)} unités au prix de vente actuel</small>
        </article>
      </div>

      {stats.revenue.unpricedItems > 0 ||
      stats.stockValue.unpricedUnits > 0 ? (
        <p className="admin-analytics-data-warning">
          Les montants excluent {stats.revenue.unpricedItems} article
          {stats.revenue.unpricedItems > 1 ? "s" : ""} vendu
          {stats.revenue.unpricedItems > 1 ? "s" : ""} et{" "}
          {stats.stockValue.unpricedUnits} unité
          {stats.stockValue.unpricedUnits > 1 ? "s" : ""} en stock sans prix
          numérique.
        </p>
      ) : null}

      <section className="admin-ui-card admin-analytics-customers-card">
        <div className="admin-analytics-card-head compact">
          <div>
            <span className="admin-ui-kicker">Clientèle</span>
            <h3>Relation et fidélité</h3>
          </div>
          <Users size={18} strokeWidth={1.8} aria-hidden="true" />
        </div>

        <div className="admin-analytics-customers-grid">
          <div className="admin-analytics-customer-metrics">
            <article>
              <span className="admin-analytics-customer-icon burgundy">
                <Users size={16} strokeWidth={1.9} aria-hidden="true" />
              </span>
              <small>Clientes enregistrées</small>
              <strong>{formatInteger(stats.customers.total)}</strong>
            </article>
            <article>
              <span className="admin-analytics-customer-icon gold">
                <UserPlus size={16} strokeWidth={1.9} aria-hidden="true" />
              </span>
              <small>Nouvelles ce mois</small>
              <strong>{formatInteger(stats.customers.newThisMonth)}</strong>
            </article>
            <article>
              <span className="admin-analytics-customer-icon green">
                <WalletCards size={16} strokeWidth={1.9} aria-hidden="true" />
              </span>
              <small>Montant moyen par cliente</small>
              <strong>{formatCurrency(stats.customers.averageSpent)}</strong>
            </article>
          </div>

          <div className="admin-analytics-top-customers">
            <strong>Meilleures clientes</strong>
            {stats.customers.top.length > 0 ? (
              <div className="admin-analytics-ranking-list customers">
                {stats.customers.top.map((customer) => (
                  <article key={customer.customerId}>
                    <span className="admin-analytics-rank">{customer.rank}</span>
                    <div>
                      <strong>{customer.name}</strong>
                      <small>
                        {customer.customerCode} · {customer.completedOrders} terminée
                        {customer.completedOrders > 1 ? "s" : ""}
                      </small>
                      <span className="admin-analytics-ranking-track">
                        <span
                          style={{
                            width: `${(customer.totalSpent / maxCustomerSpent) * 100}%`,
                          }}
                        />
                      </span>
                    </div>
                    <strong>{formatCurrency(customer.totalSpent)}</strong>
                  </article>
                ))}
              </div>
            ) : (
              <div className="admin-analytics-empty compact">
                <p>Les clientes apparaîtront après la première commande.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="admin-analytics-primary-grid">
        <section className="admin-ui-card admin-analytics-chart-card">
          <div className="admin-analytics-card-head">
            <div>
              <span className="admin-ui-kicker">Ventes</span>
              <h3>Évolution du chiffre d’affaires</h3>
              <p>
                {salesSummary.orders} commande
                {salesSummary.orders > 1 ? "s" : ""} ·{" "}
                {salesSummary.quantity} pièce
                {salesSummary.quantity > 1 ? "s" : ""}
              </p>
            </div>
            <div
              className="admin-analytics-period-switch"
              role="group"
              aria-label="Période du graphique des ventes"
            >
              <button
                type="button"
                className={salesPeriod === "months" ? "active" : ""}
                aria-pressed={salesPeriod === "months"}
                onClick={() => setSalesPeriod("months")}
              >
                12 mois
              </button>
              <button
                type="button"
                className={salesPeriod === "weeks" ? "active" : ""}
                aria-pressed={salesPeriod === "weeks"}
                onClick={() => setSalesPeriod("weeks")}
              >
                8 semaines
              </button>
            </div>
          </div>

          <AdminLineChart
            points={salesSeries.map((point) => ({
              key: point.key,
              label: point.label,
              value: point.revenue,
            }))}
            label={`Chiffre d'affaires sur ${salesPeriod === "months" ? "12 mois" : "8 semaines"}`}
            valueFormatter={formatCurrency}
          />
        </section>

        <section className="admin-ui-card admin-analytics-orders-card">
          <div className="admin-analytics-card-head compact">
            <div>
              <span className="admin-ui-kicker">Commandes</span>
              <h3>Répartition par statut</h3>
            </div>
            <ClipboardList size={18} strokeWidth={1.8} aria-hidden="true" />
          </div>

          <div className="admin-analytics-order-overview">
            <div
              className="admin-analytics-donut"
              style={{ background: donutGradient }}
              role="img"
              aria-label={`${orderTotal} commandes au total`}
            >
              <span>
                <strong>{orderTotal}</strong>
                <small>Total</small>
              </span>
            </div>
            <div className="admin-analytics-status-list">
              {statusSegments.map((segment) => (
                <div key={segment.status}>
                  <span
                    className="admin-analytics-status-dot"
                    style={{ backgroundColor: segment.color }}
                  />
                  <span>{segment.label}</span>
                  <strong>{segment.count}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className="admin-ui-card admin-analytics-stock-chart">
        <div className="admin-analytics-card-head">
          <div>
            <span className="admin-ui-kicker">Inventaire</span>
            <h3>Évolution du stock sur 30 jours</h3>
            <p>
              Stock actuel : {formatInteger(stats.catalog.totalUnits)} unités
              sur {stats.catalog.availableProducts} références disponibles.
            </p>
          </div>
          <Boxes size={19} strokeWidth={1.8} aria-hidden="true" />
        </div>

        <AdminLineChart
          points={stats.stockEvolution}
          label="Évolution du nombre total d’unités en stock sur 30 jours"
          valueFormatter={formatInteger}
        />
      </section>

      <div className="admin-analytics-rankings">
        <section className="admin-ui-card admin-analytics-ranking-card">
          <div className="admin-analytics-card-head compact">
            <div>
              <span className="admin-ui-kicker">Performance</span>
              <h3>Produits les plus vendus</h3>
            </div>
            <Trophy size={18} strokeWidth={1.8} aria-hidden="true" />
          </div>

          {stats.topProducts.length > 0 ? (
            <div className="admin-analytics-ranking-list">
              {stats.topProducts.map((product) => (
                <article key={product.productId}>
                  <span className="admin-analytics-rank">{product.rank}</span>
                  <div>
                    <strong>{product.name}</strong>
                    <small>
                      {product.reference || "Produit supprimé"} ·{" "}
                      {product.orders} commande
                      {product.orders > 1 ? "s" : ""}
                    </small>
                    <span className="admin-analytics-ranking-track">
                      <span
                        style={{
                          width: `${(product.quantity / maxProductQuantity) * 100}%`,
                        }}
                      />
                    </span>
                  </div>
                  <strong>
                    {product.quantity} pièce
                    {product.quantity > 1 ? "s" : ""}
                  </strong>
                </article>
              ))}
            </div>
          ) : (
            <div className="admin-analytics-empty">
              <ShoppingBag size={20} strokeWidth={1.6} aria-hidden="true" />
              <p>Les produits apparaîtront après la première commande terminée.</p>
            </div>
          )}
        </section>

        <section className="admin-ui-card admin-analytics-ranking-card">
          <div className="admin-analytics-card-head compact">
            <div>
              <span className="admin-ui-kicker">Catalogue</span>
              <h3>Catégories les plus vendues</h3>
            </div>
            <Tags size={18} strokeWidth={1.8} aria-hidden="true" />
          </div>

          {groupedCategories.length > 0 ? (
            <div className="admin-analytics-ranking-list categories">
              {groupedCategories.map((category, index) => (
                <article key={category.label}>
                  <span className="admin-analytics-rank">{index + 1}</span>
                  <div>
                    <strong>{category.label}</strong>
                    <small>{formatCurrency(category.revenue)}</small>
                    <span className="admin-analytics-ranking-track">
                      <span
                        style={{
                          width: `${(category.quantity / maxCategoryQuantity) * 100}%`,
                        }}
                      />
                    </span>
                  </div>
                  <strong>
                    {category.quantity} pièce
                    {category.quantity > 1 ? "s" : ""}
                  </strong>
                </article>
              ))}
            </div>
          ) : (
            <div className="admin-analytics-empty">
              <ChartNoAxesCombined
                size={20}
                strokeWidth={1.6}
                aria-hidden="true"
              />
              <p>La répartition se construira avec les ventes terminées.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
