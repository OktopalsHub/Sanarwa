export type BillingCurrency = "USD" | "NGN";

export interface TokenPackageCatalogItem {
  id: string;
  tokens: number;
  price: number;
  pricePerToken: number;
  savings: number;
  currency: BillingCurrency;
  kind?: "managed" | "byo";
}

const usdManaged: TokenPackageCatalogItem[] = [
  {
    id: "usd-3000",
    tokens: 3000,
    price: 1,
    pricePerToken: 1 / 3000,
    savings: 0,
    currency: "USD",
    kind: "managed",
  },
  {
    id: "usd-15000",
    tokens: 15000,
    price: 5,
    pricePerToken: 5 / 15000,
    savings: 0,
    currency: "USD",
    kind: "managed",
  },
  {
    id: "usd-60000",
    tokens: 60000,
    price: 20,
    pricePerToken: 20 / 60000,
    savings: 0,
    currency: "USD",
    kind: "managed",
  },
  {
    id: "usd-300000",
    tokens: 300000,
    price: 90,
    pricePerToken: 90 / 300000,
    savings: 10,
    currency: "USD",
    kind: "managed",
  },
];

const ngnManaged: TokenPackageCatalogItem[] = [
  {
    id: "ngn-3000",
    tokens: 3000,
    price: 1000,
    pricePerToken: 1000 / 3000,
    savings: 0,
    currency: "NGN",
    kind: "managed",
  },
  {
    id: "ngn-15000",
    tokens: 15000,
    price: 5000,
    pricePerToken: 5000 / 15000,
    savings: 0,
    currency: "NGN",
    kind: "managed",
  },
  {
    id: "ngn-60000",
    tokens: 60000,
    price: 20000,
    pricePerToken: 20000 / 60000,
    savings: 0,
    currency: "NGN",
    kind: "managed",
  },
  {
    id: "ngn-300000",
    tokens: 300000,
    price: 90000,
    pricePerToken: 90000 / 300000,
    savings: 10,
    currency: "NGN",
    kind: "managed",
  },
];

const usdByo: TokenPackageCatalogItem[] = [
  {
    id: "byo-usd-1250",
    tokens: 1250,
    price: 1,
    pricePerToken: 1 / 1250,
    savings: 0,
    currency: "USD",
    kind: "byo",
  },
  {
    id: "byo-usd-6250",
    tokens: 6250,
    price: 5,
    pricePerToken: 5 / 6250,
    savings: 0,
    currency: "USD",
    kind: "byo",
  },
  {
    id: "byo-usd-25000",
    tokens: 25000,
    price: 20,
    pricePerToken: 20 / 25000,
    savings: 0,
    currency: "USD",
    kind: "byo",
  },
  {
    id: "byo-usd-123750",
    tokens: 123750,
    price: 90,
    pricePerToken: 90 / 123750,
    savings: 10,
    currency: "USD",
    kind: "byo",
  },
];

const ngnByo: TokenPackageCatalogItem[] = [
  {
    id: "byo-ngn-1250",
    tokens: 1250,
    price: 1000,
    pricePerToken: 1000 / 1250,
    savings: 0,
    currency: "NGN",
    kind: "byo",
  },
  {
    id: "byo-ngn-6250",
    tokens: 6250,
    price: 5000,
    pricePerToken: 5000 / 6250,
    savings: 0,
    currency: "NGN",
    kind: "byo",
  },
  {
    id: "byo-ngn-25000",
    tokens: 25000,
    price: 20000,
    pricePerToken: 20000 / 25000,
    savings: 0,
    currency: "NGN",
    kind: "byo",
  },
  {
    id: "byo-ngn-123750",
    tokens: 123750,
    price: 90000,
    pricePerToken: 90000 / 123750,
    savings: 10,
    currency: "NGN",
    kind: "byo",
  },
];

export const TOKEN_PACKAGE_CATALOG: TokenPackageCatalogItem[] = [
  ...usdManaged,
  ...ngnManaged,
  ...usdByo,
  ...ngnByo,
];

export function getTokenPackagesResponse() {
  return {
    packages: TOKEN_PACKAGE_CATALOG,
    shelves: {
      managed: { USD: usdManaged, NGN: ngnManaged },
      byo: { USD: usdByo, NGN: ngnByo },
    },
  };
}

export function resolvePackage(
  packageId: string,
  currency: BillingCurrency,
): TokenPackageCatalogItem {
  const normalizedCurrency = currency.toUpperCase() as BillingCurrency;
  const pkg = TOKEN_PACKAGE_CATALOG.find(
    (item) => item.id === packageId && item.currency === normalizedCurrency,
  );

  if (!pkg) {
    throw new Error(`Unknown package ${packageId} for currency ${currency}`);
  }

  return pkg;
}

export function packagePriceMinor(pkg: TokenPackageCatalogItem): number {
  return Math.round(pkg.price * 100);
}

export function parseNotifiPurchaseReference(reference?: string | null): string | null {
  if (!reference) return null;
  const prefix = "notifi_purchase_";
  if (!reference.startsWith(prefix)) return null;
  return reference.slice(prefix.length) || null;
}

export function buildNotifiPurchaseReference(purchaseId: string): string {
  return `notifi_purchase_${purchaseId}`;
}

const PAYMENT_METHOD_SETUP_PREFIX = "notifi_pm_setup_";

export function buildNotifiPaymentMethodSetupReference(setupReference: string): string {
  return `${PAYMENT_METHOD_SETUP_PREFIX}${setupReference}`;
}

export function parseNotifiPaymentMethodSetupReference(reference?: string | null): string | null {
  if (!reference) return null;
  if (!reference.startsWith(PAYMENT_METHOD_SETUP_PREFIX)) return null;
  return reference.slice(PAYMENT_METHOD_SETUP_PREFIX.length) || null;
}
