import { createHash } from "node:crypto";
import { Types } from "mongoose";
import { AppError } from "../../utils/AppError";
import { logger } from "../../utils/logger";
import { OrderModel, type OrderRecord } from "../orders/order.model";
import { CustomerModel } from "./customer.model";

type CustomerListInput = {
  search?: unknown;
  sort?: unknown;
  page?: unknown;
  pageSize?: unknown;
};

type CustomerOrderSnapshot = Pick<
  OrderRecord,
  | "customerName"
  | "customerPhone"
  | "items"
  | "status"
  | "createdAt"
  | "completedAt"
> & {
  _id: Types.ObjectId;
  reference: string;
};

type CustomerGroup = {
  normalizedPhone: string;
  orders: CustomerOrderSnapshot[];
};

let synchronizationPromise: Promise<void> | null = null;
let synchronizationRequested = false;

export function normalizeCustomerPhone(value: string) {
  let digits = value.replace(/\D/g, "");

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.length === 8) {
    digits = `22901${digits}`;
  } else if (digits.length === 10 && digits.startsWith("01")) {
    digits = `229${digits}`;
  }

  return digits;
}

export function buildCustomerCode(normalizedPhone: string) {
  const fingerprint = createHash("sha256")
    .update(normalizedPhone)
    .digest("hex")
    .slice(0, 12)
    .toUpperCase();

  return `TLS-C-${fingerprint}`;
}

function getOrderKnownTotal(order: CustomerOrderSnapshot) {
  return order.items.reduce(
    (total, item) => total + (item.unitPrice ?? 0) * item.quantity,
    0,
  );
}

function readPositiveInteger(value: unknown, fallback: number, maximum: number) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, maximum);
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function synchronizeCustomersOnce() {
  const orders = (await OrderModel.find()
    .select(
      "_id reference customerName customerPhone items status createdAt completedAt",
    )
    .sort({ createdAt: 1, _id: 1 })
    .lean()) as CustomerOrderSnapshot[];
  const groups = new Map<string, CustomerGroup>();

  for (const order of orders) {
    const normalizedPhone = normalizeCustomerPhone(order.customerPhone);

    if (!normalizedPhone) {
      logger.warn("Commande sans téléphone exploitable pour la cliente.", {
        event: "customer.order_unlinked",
        orderId: String(order._id),
        orderReference: order.reference,
      });
      continue;
    }

    const group = groups.get(normalizedPhone) ?? {
      normalizedPhone,
      orders: [],
    };
    group.orders.push(order);
    groups.set(normalizedPhone, group);
  }

  const activeCustomerIds: Types.ObjectId[] = [];
  const orderUpdates: Parameters<typeof OrderModel.bulkWrite>[0] = [];
  const now = new Date();

  for (const group of groups.values()) {
    const firstOrder = group.orders[0];
    const lastOrder = group.orders[group.orders.length - 1];

    if (!firstOrder || !lastOrder) {
      continue;
    }

    const completedOrders = group.orders.filter(
      (order) => order.status === "completed",
    );
    const customer = await CustomerModel.findOneAndUpdate(
      { normalizedPhone: group.normalizedPhone },
      {
        $set: {
          customerCode: buildCustomerCode(group.normalizedPhone),
          name: lastOrder.customerName,
          phone: lastOrder.customerPhone,
          orderCount: group.orders.length,
          completedOrderCount: completedOrders.length,
          totalSpent: completedOrders.reduce(
            (total, order) => total + getOrderKnownTotal(order),
            0,
          ),
          lastOrderId: lastOrder._id,
          lastOrderReference: lastOrder.reference,
          lastOrderAt: lastOrder.createdAt,
          updatedAt: now,
        },
        $setOnInsert: {
          normalizedPhone: group.normalizedPhone,
        },
        $min: {
          createdAt: firstOrder.createdAt,
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );

    if (!customer) {
      throw new AppError("Impossible de créer le profil cliente.", 500);
    }

    activeCustomerIds.push(customer._id);
    orderUpdates.push({
      updateMany: {
        filter: {
          _id: { $in: group.orders.map((order) => order._id) },
          customerId: { $ne: customer._id },
        },
        update: {
          $set: { customerId: customer._id },
        },
      },
    });
  }

  if (orderUpdates.length > 0) {
    await OrderModel.bulkWrite(orderUpdates, { ordered: false });
  }

  if (activeCustomerIds.length === 0) {
    await CustomerModel.deleteMany({});
  } else {
    await CustomerModel.deleteMany({
      _id: { $nin: activeCustomerIds },
    });
  }
}

export async function synchronizeCustomers() {
  synchronizationRequested = true;

  if (!synchronizationPromise) {
    synchronizationPromise = (async () => {
      do {
        synchronizationRequested = false;
        await synchronizeCustomersOnce();
      } while (synchronizationRequested);
    })().finally(() => {
      synchronizationPromise = null;
    });
  }

  return synchronizationPromise;
}

export async function synchronizeCustomersSafely() {
  try {
    await synchronizeCustomers();
  } catch (error) {
    logger.error("Impossible de synchroniser les profils clientes.", {
      event: "customers.sync_failed",
      error,
    });
  }
}

export async function listCustomers(input: CustomerListInput) {
  const search = readString(input.search);
  const requestedSort = readString(input.sort);
  const page = readPositiveInteger(input.page, 1, 100_000);
  const pageSize = readPositiveInteger(input.pageSize, 12, 100);
  const filter: Record<string, unknown> = {};
  const sortOptions: Record<string, Record<string, 1 | -1>> = {
    recent: { lastOrderAt: -1, name: 1 },
    "spent-desc": { totalSpent: -1, lastOrderAt: -1 },
    "orders-desc": { orderCount: -1, lastOrderAt: -1 },
    "name-asc": { name: 1, lastOrderAt: -1 },
  };
  const sort = sortOptions[requestedSort] ?? sortOptions.recent;

  if (search) {
    const expression = new RegExp(escapeRegExp(search), "i");
    filter.$or = [
      { customerCode: expression },
      { name: expression },
      { phone: expression },
      { normalizedPhone: expression },
      { lastOrderReference: expression },
    ];
  }

  const [items, total] = await Promise.all([
    CustomerModel.find(filter)
      .sort(sort)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    CustomerModel.countDocuments(filter),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getCustomerDetails(id: string) {
  const customer = await CustomerModel.findById(id).lean();

  if (!customer) {
    throw new AppError("Cliente introuvable.", 404);
  }

  const orders = await OrderModel.find({ customerId: customer._id })
    .sort({ createdAt: -1 })
    .lean();

  return { customer, orders };
}
