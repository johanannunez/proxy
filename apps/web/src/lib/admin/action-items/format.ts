/** "$4,250" from 425000 cents. */
export function formatUsdCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/** Compact: 58200 -> "$58k", 4250 -> "$4.3k", 900 -> "$900". */
export function formatUsdShort(dollars: number): string {
  if (Math.abs(dollars) >= 1000) {
    const k = dollars / 1000;
    const rounded = k >= 10 ? Math.round(k) : Math.round(k * 10) / 10;
    return `$${rounded}k`;
  }
  return `$${Math.round(dollars)}`;
}
