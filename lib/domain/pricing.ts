/** Final price after a service's percentage discount, in UZS. */
export function priceOf(service: { price: number; discount?: number }): number {
  const percent = Math.min(100, Math.max(0, Number(service.discount) || 0));
  return Math.round(service.price * (100 - percent) / 100);
}
