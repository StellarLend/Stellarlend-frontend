// lib/lending/markets.ts
import { useEffect, useState } from 'react';
import axios from 'axios';

const fetchMarketRates = async (asset: string) => {
  try {
    const response = await axios.get(`/api/markets?asset=${asset}`);
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch market rates for asset ${asset}:`, error);
    return null;
  }
};

export const useMarketRates = (asset: string) => {
  const [rates, setRates] = useState<{ min: number; max: number; default: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchRates = async () => {
      const ratesData = await fetchMarketRates(asset);
      if (isMounted) {
        setRates(ratesData);
      }
    };

    fetchRates();

    return () => {
      isMounted = false;
    };
  }, [asset]);

  return { rates, error };
};