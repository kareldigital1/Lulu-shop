import type { Order } from "@/core/domain/models/order";
import { DEFAULT_CLOTHING_SIZE } from "@/core/domain/models/product";
import { resolveApiAssetUrl } from "../http/request-manager";

export function mapOrderDto(order: Order): Order {
  return {
    ...order,
    items: order.items.map((item) => ({
      ...item,
      size: item.size ?? DEFAULT_CLOTHING_SIZE,
      image: item.image ? resolveApiAssetUrl(item.image) : "",
    })),
  };
}
