import { NextResponse } from "next/server";
import type { SupportedAsset } from "@/lib/prices/types";
import { SUPPORTED_ASSETS } from "@/lib/prices/constants";

export const runtime = "nodejs";

type PriceUpdate = {
  symbol: SupportedAsset;
  price: number;
  timestamp: string;
};

function formatSSE(data: PriceUpdate): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function GET() {
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        new TextEncoder().encode("retry: 3000\n\n"),
      );

      for (const asset of SUPPORTED_ASSETS) {
        const basePrices: Record<SupportedAsset, number> = {
          XLM: 0.1245,
          USDC: 1.0,
          BTC: 67340.5,
          ETH: 3480.2,
        };

        const update: PriceUpdate = {
          symbol: asset,
          price: basePrices[asset],
          timestamp: new Date().toISOString(),
        };

        controller.enqueue(
          new TextEncoder().encode(formatSSE(update)),
        );
      }

      const interval = setInterval(() => {
        const randomAsset =
          SUPPORTED_ASSETS[Math.floor(Math.random() * SUPPORTED_ASSETS.length)];
        const basePrices: Record<SupportedAsset, number> = {
          XLM: 0.1245,
          USDC: 1.0,
          BTC: 67340.5,
          ETH: 3480.2,
        };

        const update: PriceUpdate = {
          symbol: randomAsset,
          price: basePrices[randomAsset] * (0.99 + Math.random() * 0.02),
          timestamp: new Date().toISOString(),
        };

        controller.enqueue(
          new TextEncoder().encode(formatSSE(update)),
        );
      }, 3000);

      (controller as any).cleanup = () => {
        clearInterval(interval);
      };
    },
    cancel() {
      try {
        const anyController = this as any;
        if (typeof anyController.cleanup === "function") {
          anyController.cleanup();
        }
      } catch {
        // noop
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}