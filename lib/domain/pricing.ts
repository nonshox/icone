/**
 * Prices and durations for a visit.
 *
 * A visit can hold several services, so everything here works on a list. The
 * amount charged is the amount shown: there are no discounts, promotions or
 * platform fees in this product (see docs/PROJECT.md).
 */

export type Priced = {
  price: number;
  time: number;
  buffer?: number;
};

/** What one service costs and how long it takes, as offered to this customer. */
export function priceOf(service: Priced): number {
  return Math.max(0, Math.round(service.price));
}

/** Total price of every service in the visit. */
export function visitPrice(services: Priced[]): number {
  return services.reduce((total, service) => total + priceOf(service), 0);
}

/** Minutes the appointment occupies, including the buffer after the last one. */
export function visitTime(services: Priced[]): number {
  const work = services.reduce((total, service) => total + Math.max(0, service.time), 0);
  const buffer = services.length > 0 ? Math.max(0, services[services.length - 1].buffer ?? 0) : 0;
  return work + buffer;
}

/** Minutes between two clock times, clamped to a whole day. */
export function duration(start: number, end: number): number {
  return Math.max(0, Math.min(1440, end - start));
}
