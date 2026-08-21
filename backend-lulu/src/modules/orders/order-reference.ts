const ORDER_REFERENCE_TIME_ZONE = "Africa/Porto-Novo";

export function buildOrderReferenceDatePart(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ORDER_REFERENCE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const year = values.get("year");
  const month = values.get("month");
  const day = values.get("day");

  if (!year || !month || !day) {
    throw new Error("Impossible de déterminer la date de la référence de commande.");
  }

  return `${year}${month}${day}`;
}
