import { CustomerModel } from "../customers/customer.model";
import { OrderModel, type OrderStatus } from "../orders/order.model";
import { ProductModel } from "../products/product.model";
import { resolveProductPricing } from "../products/product-pricing";
import { StockMovementModel } from "../stock-movements/stock-movement.model";

const DASHBOARD_TIME_ZONE = "Africa/Porto-Novo";
const DASHBOARD_UTC_OFFSET = "+01:00";
const MONTH_SERIES_LENGTH = 12;
const WEEK_SERIES_LENGTH = 8;
const STOCK_SERIES_LENGTH = 30;
const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
  "expired",
];

type DailySalesRow = {
  _id: string;
  revenue: number;
  orders: number;
  quantity: number;
  unpricedQuantity: number;
};

type SalesSummaryRow = {
  _id: null;
  revenue: number;
  orders: number;
  quantity: number;
  unpricedQuantity: number;
};

type RankedSalesRow = {
  _id: unknown;
  name: string;
  revenue: number;
  orders: number;
  quantity: number;
};

type StockMovementDayRow = {
  _id: string;
  difference: number;
};

type CustomerSpendSummaryRow = {
  _id: null;
  totalSpent: number;
};

function getDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: DASHBOARD_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function dateKeyToUtcDate(dateKey: string) {
  return new Date(`${dateKey}T12:00:00.000Z`);
}

function shiftDateKey(dateKey: string, days: number) {
  const date = dateKeyToUtcDate(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getWeekStartKey(dateKey: string) {
  const date = dateKeyToUtcDate(dateKey);
  const day = date.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  return shiftDateKey(dateKey, -daysSinceMonday);
}

function getMonthKeys(todayKey: string) {
  const [year, month] = todayKey.split("-").map(Number);

  return Array.from({ length: MONTH_SERIES_LENGTH }, (_, index) => {
    const date = new Date(
      Date.UTC(year, month - MONTH_SERIES_LENGTH + index, 1),
    );
    return date.toISOString().slice(0, 7);
  });
}

function getWeekKeys(todayKey: string) {
  const currentWeek = getWeekStartKey(todayKey);

  return Array.from({ length: WEEK_SERIES_LENGTH }, (_, index) =>
    shiftDateKey(currentWeek, (index - WEEK_SERIES_LENGTH + 1) * 7),
  );
}

function getDayKeys(todayKey: string, length: number) {
  return Array.from({ length }, (_, index) =>
    shiftDateKey(todayKey, index - length + 1),
  );
}

function formatMonthLabel(monthKey: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  })
    .format(new Date(`${monthKey}-01T12:00:00.000Z`))
    .replace(".", "");
}

function formatWeekLabel(dateKey: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(dateKeyToUtcDate(dateKey));
}

function formatDayLabel(dateKey: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  })
    .format(dateKeyToUtcDate(dateKey))
    .replace(".", "");
}

function sumSalesRows(rows: DailySalesRow[]) {
  return rows.reduce(
    (total, row) => ({
      revenue: total.revenue + row.revenue,
      orders: total.orders + row.orders,
      quantity: total.quantity + row.quantity,
      unpricedQuantity:
        total.unpricedQuantity + row.unpricedQuantity,
    }),
    { revenue: 0, orders: 0, quantity: 0, unpricedQuantity: 0 },
  );
}

async function getDailySales(startDate: Date) {
  return OrderModel.aggregate<DailySalesRow>([
    {
      $match: {
        status: "completed",
      },
    },
    {
      $set: {
        dashboardDate: { $ifNull: ["$completedAt", "$updatedAt"] },
      },
    },
    {
      $match: {
        dashboardDate: { $gte: startDate },
      },
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: {
          day: {
            $dateToString: {
              date: "$dashboardDate",
              format: "%Y-%m-%d",
              timezone: DASHBOARD_TIME_ZONE,
            },
          },
          orderId: "$_id",
        },
        revenue: {
          $sum: {
            $cond: [
              { $isNumber: "$items.unitPrice" },
              { $multiply: ["$items.unitPrice", "$items.quantity"] },
              0,
            ],
          },
        },
        quantity: { $sum: "$items.quantity" },
        unpricedQuantity: {
          $sum: {
            $cond: [
              { $isNumber: "$items.unitPrice" },
              0,
              "$items.quantity",
            ],
          },
        },
      },
    },
    {
      $group: {
        _id: "$_id.day",
        revenue: { $sum: "$revenue" },
        orders: { $sum: 1 },
        quantity: { $sum: "$quantity" },
        unpricedQuantity: { $sum: "$unpricedQuantity" },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}

async function getSalesSummary() {
  const [summary] = await OrderModel.aggregate<SalesSummaryRow>([
    { $match: { status: "completed" } },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$_id",
        revenue: {
          $sum: {
            $cond: [
              { $isNumber: "$items.unitPrice" },
              { $multiply: ["$items.unitPrice", "$items.quantity"] },
              0,
            ],
          },
        },
        quantity: { $sum: "$items.quantity" },
        unpricedQuantity: {
          $sum: {
            $cond: [
              { $isNumber: "$items.unitPrice" },
              0,
              "$items.quantity",
            ],
          },
        },
      },
    },
    {
      $group: {
        _id: null,
        revenue: { $sum: "$revenue" },
        orders: { $sum: 1 },
        quantity: { $sum: "$quantity" },
        unpricedQuantity: { $sum: "$unpricedQuantity" },
      },
    },
  ]);

  return (
    summary ?? {
      revenue: 0,
      orders: 0,
      quantity: 0,
      unpricedQuantity: 0,
    }
  );
}

async function getOrderStatusCounts() {
  const rows = await OrderModel.aggregate<{ _id: OrderStatus; count: number }>([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);
  const counts = Object.fromEntries(
    ORDER_STATUSES.map((status) => [status, 0]),
  ) as Record<OrderStatus, number>;

  rows.forEach((row) => {
    if (ORDER_STATUSES.includes(row._id)) {
      counts[row._id] = row.count;
    }
  });

  return counts;
}

async function getTopProductSales() {
  return OrderModel.aggregate<RankedSalesRow>([
    { $match: { status: "completed" } },
    { $unwind: "$items" },
    {
      $match: {
        "items.source": "catalog",
        "items.productId": { $ne: null },
      },
    },
    {
      $group: {
        _id: {
          productId: "$items.productId",
          orderId: "$_id",
        },
        name: { $first: "$items.name" },
        revenue: {
          $sum: {
            $cond: [
              { $isNumber: "$items.unitPrice" },
              { $multiply: ["$items.unitPrice", "$items.quantity"] },
              0,
            ],
          },
        },
        quantity: { $sum: "$items.quantity" },
      },
    },
    {
      $group: {
        _id: "$_id.productId",
        name: { $first: "$name" },
        revenue: { $sum: "$revenue" },
        orders: { $sum: 1 },
        quantity: { $sum: "$quantity" },
      },
    },
    { $sort: { quantity: -1, orders: -1, revenue: -1 } },
    { $limit: 5 },
  ]);
}

async function getCategorySales() {
  return OrderModel.aggregate<RankedSalesRow>([
    { $match: { status: "completed" } },
    { $unwind: "$items" },
    {
      $match: {
        "items.category": { $nin: ["", null] },
      },
    },
    {
      $group: {
        _id: {
          category: "$items.category",
          orderId: "$_id",
        },
        name: { $first: "$items.category" },
        revenue: {
          $sum: {
            $cond: [
              { $isNumber: "$items.unitPrice" },
              { $multiply: ["$items.unitPrice", "$items.quantity"] },
              0,
            ],
          },
        },
        quantity: { $sum: "$items.quantity" },
      },
    },
    {
      $group: {
        _id: "$_id.category",
        name: { $first: "$name" },
        revenue: { $sum: "$revenue" },
        orders: { $sum: 1 },
        quantity: { $sum: "$quantity" },
      },
    },
    { $sort: { quantity: -1, orders: -1, revenue: -1 } },
  ]);
}

async function getStockMovementDays(startDate: Date) {
  return StockMovementModel.aggregate<StockMovementDayRow>([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: {
          $dateToString: {
            date: "$createdAt",
            format: "%Y-%m-%d",
            timezone: DASHBOARD_TIME_ZONE,
          },
        },
        difference: { $sum: "$difference" },
      },
    },
    { $sort: { _id: 1 } },
  ]);
}

async function getCustomerSummary(monthStartDate: Date) {
  const [total, newThisMonth, topCustomers, spendRows] = await Promise.all([
    CustomerModel.countDocuments(),
    CustomerModel.countDocuments({ createdAt: { $gte: monthStartDate } }),
    CustomerModel.find()
      .select(
        "_id customerCode name phone totalSpent orderCount completedOrderCount",
      )
      .sort({ totalSpent: -1, completedOrderCount: -1, lastOrderAt: -1 })
      .limit(5)
      .lean(),
    CustomerModel.aggregate<CustomerSpendSummaryRow>([
      {
        $group: {
          _id: null,
          totalSpent: { $sum: "$totalSpent" },
        },
      },
    ]),
  ]);
  const totalSpent = spendRows[0]?.totalSpent ?? 0;

  return {
    total,
    newThisMonth,
    averageSpent: total > 0 ? Math.round(totalSpent / total) : 0,
    top: topCustomers.map((customer, index) => ({
      customerId: String(customer._id),
      customerCode: customer.customerCode,
      name: customer.name,
      phone: customer.phone,
      rank: index + 1,
      totalSpent: customer.totalSpent,
      totalOrders: customer.orderCount,
      completedOrders: customer.completedOrderCount,
    })),
  };
}

export async function getAdminDashboardStats(now = new Date()) {
  const todayKey = getDateKey(now);
  const monthKeys = getMonthKeys(todayKey);
  const weekKeys = getWeekKeys(todayKey);
  const stockDayKeys = getDayKeys(todayKey, STOCK_SERIES_LENGTH);
  const salesStartDate = new Date(
    `${monthKeys[0]}-01T00:00:00${DASHBOARD_UTC_OFFSET}`,
  );
  const stockStartDate = new Date(
    `${stockDayKeys[0]}T00:00:00${DASHBOARD_UTC_OFFSET}`,
  );
  const monthStartDate = new Date(
    `${todayKey.slice(0, 7)}-01T00:00:00${DASHBOARD_UTC_OFFSET}`,
  );

  const [
    dailySales,
    salesSummary,
    ordersByStatus,
    topProductRows,
    categoryRows,
    stockMovementDays,
    products,
    customers,
  ] = await Promise.all([
    getDailySales(salesStartDate),
    getSalesSummary(),
    getOrderStatusCounts(),
    getTopProductSales(),
    getCategorySales(),
    getStockMovementDays(stockStartDate),
    ProductModel.find()
      .select(
        "_id name reference status stock priceLabel priceAmount promotionPrice promotionStartAt promotionEndAt",
      )
      .lean(),
    getCustomerSummary(monthStartDate),
  ]);

  const dailySalesMap = new Map(dailySales.map((row) => [row._id, row]));
  const monthlySales = monthKeys.map((key) => {
    const rows = dailySales.filter((row) => row._id.startsWith(key));
    return {
      key,
      label: formatMonthLabel(key),
      ...sumSalesRows(rows),
    };
  });
  const weeklySales = weekKeys.map((key) => {
    const rows = dailySales.filter(
      (row) => getWeekStartKey(row._id) === key,
    );
    return {
      key,
      label: formatWeekLabel(key),
      ...sumSalesRows(rows),
    };
  });
  const todaySales = dailySalesMap.get(todayKey) ?? {
    revenue: 0,
    orders: 0,
    quantity: 0,
    unpricedQuantity: 0,
  };
  const currentMonthSales =
    monthlySales.at(-1) ?? sumSalesRows([]);
  const currentWeekSales =
    weeklySales.at(-1) ?? sumSalesRows([]);

  const totalStock = products.reduce(
    (total, product) => total + product.stock,
    0,
  );
  const stockValue = products.reduce(
    (total, product) => {
      const currentPrice = resolveProductPricing(product, now).currentPrice;

      if (currentPrice === null) {
        total.unpricedUnits += product.stock;
      } else {
        total.amount += currentPrice * product.stock;
        total.pricedUnits += product.stock;
      }

      return total;
    },
    { amount: 0, pricedUnits: 0, unpricedUnits: 0 },
  );
  const stockDifferences = new Map(
    stockMovementDays.map((row) => [row._id, row.difference]),
  );
  const stockByDay = new Map<string, number>();
  let reconstructedStock = totalStock;

  [...stockDayKeys].reverse().forEach((key) => {
    stockByDay.set(key, reconstructedStock);
    reconstructedStock -= stockDifferences.get(key) ?? 0;
  });

  const productMap = new Map(
    products.map((product) => [String(product._id), product]),
  );
  const catalog = {
    totalProducts: products.length,
    publishedProducts: products.filter(
      (product) => product.status === "published",
    ).length,
    availableProducts: products.filter((product) => product.stock > 0).length,
    totalUnits: totalStock,
  };

  return {
    generatedAt: now.toISOString(),
    timezone: DASHBOARD_TIME_ZONE,
    revenue: {
      total: salesSummary.revenue,
      month: currentMonthSales.revenue,
      week: currentWeekSales.revenue,
      today: todaySales.revenue,
      monthOrders: currentMonthSales.orders,
      weekOrders: currentWeekSales.orders,
      todayOrders: todaySales.orders,
      todayItems: todaySales.quantity,
      completedOrders: salesSummary.orders,
      soldItems: salesSummary.quantity,
      unpricedItems: salesSummary.unpricedQuantity,
    },
    monthlySales,
    weeklySales,
    ordersByStatus,
    stockEvolution: stockDayKeys.map((key) => ({
      key,
      label: formatDayLabel(key),
      value: stockByDay.get(key) ?? totalStock,
    })),
    topProducts: topProductRows.map((row, index) => {
      const product = productMap.get(String(row._id));
      return {
        productId: String(row._id),
        name: product?.name ?? row.name,
        reference: product?.reference ?? "",
        rank: index + 1,
        revenue: row.revenue,
        orders: row.orders,
        quantity: row.quantity,
      };
    }),
    categorySales: categoryRows.map((row) => ({
      category: row.name,
      revenue: row.revenue,
      orders: row.orders,
      quantity: row.quantity,
    })),
    stockValue,
    catalog,
    customers,
  };
}
