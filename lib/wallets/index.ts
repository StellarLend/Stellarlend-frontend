import { WalletAdapter } from "./types";

export * from "./types";
export { freighterAdapter } from "./freighter";

export interface WalletAdapterEntry {
  id: string;
  name: string;
  icon: string;
  installUrl?: string;
  loadAdapter: () => Promise<WalletAdapter>;
}

export const SUPPORTED_WALLETS: WalletAdapterEntry[] = [
  {
    id: "freighter",
    name: "Freighter",
    icon: "data:image/svg+xml;utf8,<svg viewBox='0 0 24 24' fill='%236366f1' xmlns='http://www.w3.org/2000/svg'><rect width='24' height='24' rx='6'/><path d='M7 12l3 3 7-7' stroke='white' stroke-width='2' fill='none'/></svg>",
    installUrl: "https://www.freighter.app/",
    loadAdapter: async () => {
      const { freighterAdapter } = await import("./freighter");
      return freighterAdapter;
    },
  },
  {
    id: "xbull",
    name: "xBull",
    icon: "data:image/svg+xml;utf8,<svg viewBox='0 0 24 24' fill='%23ef4444' xmlns='http://www.w3.org/2000/svg'><rect width='24' height='24' rx='6'/><circle cx='12' cy='12' r='5' fill='white'/></svg>",
    installUrl: "https://xbull.app/",
    loadAdapter: async () => {
      const { xbullAdapter } = await import("./xbull");
      return xbullAdapter;
    },
  },
  {
    id: "albedo",
    name: "Albedo",
    icon: "data:image/svg+xml;utf8,<svg viewBox='0 0 24 24' fill='%2310b981' xmlns='http://www.w3.org/2000/svg'><rect width='24' height='24' rx='6'/><path d='M12 7l5 10H7z' fill='white'/></svg>",
    installUrl: "https://albedo.link/",
    loadAdapter: async () => {
      const { albedoAdapter } = await import("./albedo");
      return albedoAdapter;
    },
  },
  {
    id: "lobstr",
    name: "LOBSTR",
    icon: "data:image/svg+xml;utf8,<svg viewBox='0 0 24 24' fill='%233b82f6' xmlns='http://www.w3.org/2000/svg'><rect width='24' height='24' rx='6'/><circle cx='8' cy='12' r='3' fill='white'/><circle cx='16' cy='12' r='3' fill='white'/></svg>",
    installUrl: "https://lobstr.co/",
    loadAdapter: async () => {
      const { lobstrAdapter } = await import("./other");
      return lobstrAdapter;
    },
  },
  {
    id: "rabet",
    name: "Rabet",
    icon: "data:image/svg+xml;utf8,<svg viewBox='0 0 24 24' fill='%23f59e0b' xmlns='http://www.w3.org/2000/svg'><rect width='24' height='24' rx='6'/><path d='M8 16V8l8 8V8' stroke='white' stroke-width='2'/></svg>",
    installUrl: "https://rabet.io/",
    loadAdapter: async () => {
      const { rabetAdapter } = await import("./other");
      return rabetAdapter;
    },
  },
  {
    id: "hana",
    name: "Hana",
    icon: "data:image/svg+xml;utf8,<svg viewBox='0 0 24 24' fill='%238b5cf6' xmlns='http://www.w3.org/2000/svg'><rect width='24' height='24' rx='6'/><circle cx='12' cy='12' r='4' stroke='white' stroke-width='2' fill='none'/></svg>",
    installUrl: "https://www.hanawallet.io/",
    loadAdapter: async () => {
      const { hanaAdapter } = await import("./other");
      return hanaAdapter;
    },
  },
];

export async function getWalletAdapter(id: string): Promise<WalletAdapter | null> {
  const entry = SUPPORTED_WALLETS.find((w) => w.id === id);
  if (!entry) return null;
  return entry.loadAdapter();
}
