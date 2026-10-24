"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RpcError } from "@/lib/rpc";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000, // 15 seconds
        refetchOnWindowFocus: true,
        refetchIntervalInBackground: false,
        retry: (failureCount, error) => {
          if (failureCount >= 3) {
            return false;
          }

          // Do not retry 4xx errors
          if (error instanceof RpcError && error.status && error.status >= 400 && error.status < 500) {
            return false;
          }

          // Do not retry contract or simulation errors
          if (error instanceof RpcError && error.isSimulationError) {
            return false;
          }

          // Check generic status code or message if error has status property
          const anyErr = error as { status?: number; statusCode?: number; message?: string };
          const status = anyErr.status || anyErr.statusCode;
          if (status && status >= 400 && status < 500) {
            return false;
          }

          return true;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
      },
    },
  });
}

export function QueryProvider({
  children,
  client,
}: {
  children: React.ReactNode;
  client?: QueryClient;
}) {
  const [queryClient] = useState(() => client ?? createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
