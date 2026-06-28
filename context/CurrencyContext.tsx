"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface CurrencyContextType {
  currency: string;
  isLoading: boolean;
  error: Error | null;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<string>("USD");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchCurrency = async () => {
      try {
        const response = await fetch("/api/account/preferences");
        if (!response.ok) {
          throw new Error("Failed to fetch preferences");
        }
        const data = await response.json();
        if (data && data.currency) {
          setCurrency(data.currency);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        // Fallback to USD is handled by the initial state
      } finally {
        setIsLoading(false);
      }
    };

    fetchCurrency();
  }, []);

  return (
    <CurrencyContext.Provider value={{ currency, isLoading, error }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrencyPreference() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error("useCurrencyPreference must be used within a CurrencyProvider");
  }
  return context;
}
