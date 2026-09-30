"use client";

import { useCallback, useEffect, useState } from "react";
import { billingApi } from "@/lib/api";

interface CheckoutContextResponse {
  defaultCurrency: "USD" | "NGN";
  availableCurrencies: Array<"USD" | "NGN">;
  bachsConfigured: boolean;
  nombaConfigured: boolean;
  providers: string[];
  countryCode?: string;
}

const NG_CURRENCIES = ["NGN", "USD"] as const;

function fallbackCurrencies(countryCode?: string | null): Array<"USD" | "NGN"> {
  return countryCode === "NG" ? [...NG_CURRENCIES] : ["USD"];
}

function defaultCurrencyForCountry(countryCode?: string | null): "USD" | "NGN" {
  return countryCode === "NG" ? "NGN" : "USD";
}

export function useCheckoutCurrency() {
  const [context, setContext] = useState<CheckoutContextResponse | null>(null);
  const [isPending, setIsPending] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState<"USD" | "NGN" | null>(null);

  useEffect(() => {
    let cancelled = false;

    billingApi
      .getCheckoutContext()
      .then((data) => {
        if (!cancelled) {
          setContext(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setContext(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsPending(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const countryCode = context?.countryCode;
  const availableCurrencies = context?.availableCurrencies ?? fallbackCurrencies(countryCode);
  const defaultCurrency = context?.defaultCurrency ?? defaultCurrencyForCountry(countryCode);
  const isReady = !isPending;

  const setCurrency = useCallback((next: "USD" | "NGN") => {
    setSelectedCurrency(next);
  }, []);

  const currency = isReady ? (selectedCurrency ?? defaultCurrency) : defaultCurrency;

  return {
    currency,
    setCurrency,
    availableCurrencies,
    defaultCurrency,
    checkoutContext: context,
    isContextPending: isPending,
    isReady,
  };
}
