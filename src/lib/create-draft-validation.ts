export type WalletIdentity = {
  address?: string | null;
  network?: string | null;
  connected?: boolean;
};

export type DraftRecord = {
  id?: string | null;
  draftId?: string | null;
  owner?: string | null;
  walletAddress?: string | null;
  address?: string | null;
  network?: string | null;
  amount?: unknown;
  value?: unknown;
  token?: string | null;
  integrity?: string | null;
  status?: string | null;
};

export type ValidationContext = {
  draftId?: string | null;
  routeToken?: string | null;
  wallet?: WalletIdentity | null;
  draft?: DraftRecord | null;
  networkOverride?: string | null;
};

export class CreatePageValidationError extends Error {
  code:
    | "invalid_route"
    | "invalid_wallet"
    | "wrong_network"
    | "unauthorized"
    | "malformed_response";
  field?: string;

  constructor(
    code: CreatePageValidationError["code"],
    message: string,
    field?: string,
  ) {
    super(message);
    this.name = "CreatePageValidationError";
    this.code = code;
    this.field = field;
  }
}

const VALID_NETWORKS = new Set(["PUBLIC", "TESTNET"]);

const coerceString = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }

  if (Array.isArray(value)) {
    const first = value.find((entry) => typeof entry === "string" && entry.trim().length > 0);
    if (typeof first === "string") {
      return first.trim();
    }
  }

  return undefined;
};

export const normalizeNetwork = (value: unknown, field = "network") => {
  const raw = coerceString(value);
  if (!raw) {
    throw new CreatePageValidationError("invalid_route", `Missing ${field}`, field);
  }

  const normalized = raw.toUpperCase();
  if (!VALID_NETWORKS.has(normalized)) {
    throw new CreatePageValidationError("invalid_route", `Unsupported ${field}: ${raw}`, field);
  }

  return normalized as "PUBLIC" | "TESTNET";
};

export const validateWalletAddress = (value: unknown, field = "walletAddress") => {
  const raw = coerceString(value);
  if (!raw) {
    throw new CreatePageValidationError("invalid_wallet", `Missing ${field}`, field);
  }

  const valid = /^G[1-9A-HJ-NP-Za-km-z]{55}$/.test(raw);
  if (!valid) {
    throw new CreatePageValidationError("invalid_wallet", `Invalid ${field}: ${raw}`, field);
  }

  return raw;
};

export const validateNumericAmount = (
  value: unknown,
  field = "amount",
  options: { min?: number; max?: number } = {},
) => {
  const parsed = typeof value === "string" ? Number(value) : Number(value);

  if (!Number.isFinite(parsed)) {
    throw new CreatePageValidationError("malformed_response", `Invalid numeric value for ${field}`, field);
  }

  const minimum = options.min ?? 0;
  const maximum = options.max ?? Number.MAX_SAFE_INTEGER;
  if (parsed < minimum || parsed > maximum) {
    throw new CreatePageValidationError("malformed_response", `${field} is outside the supported range`, field);
  }

  return parsed;
};

export const parseCreateRouteParams = (input: Record<string, unknown> = {}) => {
  const draftId = coerceString(input.draftId ?? input.draft_id ?? input.id ?? input.draft);
  const routeToken = coerceString(input.resumeToken ?? input.token ?? input.resume_token ?? input.state);
  const routeNetwork = coerceString(input.network);
  const walletAddress = coerceString(input.walletAddress ?? input.wallet ?? input.address);

  if (!draftId) {
    throw new CreatePageValidationError("invalid_route", "draftId is required", "draftId");
  }

  if (routeNetwork) {
    normalizeNetwork(routeNetwork, "network");
  }

  if (walletAddress) {
    validateWalletAddress(walletAddress, "walletAddress");
  }

  return {
    draftId,
    routeToken,
    network: routeNetwork ? normalizeNetwork(routeNetwork, "network") : undefined,
    walletAddress: walletAddress ? validateWalletAddress(walletAddress, "walletAddress") : undefined,
  };
};

export const assertAuthorizedDraftAccess = (context: ValidationContext) => {
  const draftId = coerceString(context.draftId ?? context.draft?.id ?? context.draft?.draftId);
  if (!draftId) {
    throw new CreatePageValidationError("invalid_route", "draftId is required", "draftId");
  }

  const expectedWalletAddress = coerceString(context.wallet?.address);
  if (!context.wallet || context.wallet.connected === false || !expectedWalletAddress) {
    throw new CreatePageValidationError("invalid_wallet", "Wallet must be connected before resuming a draft", "walletAddress");
  }

  const walletAddress = validateWalletAddress(expectedWalletAddress, "walletAddress");

  const routeNetwork = context.networkOverride
    ? normalizeNetwork(context.networkOverride, "network")
    : context.wallet?.network
      ? normalizeNetwork(context.wallet.network, "network")
      : undefined;

  const draftNetwork = coerceString(context.draft?.network);
  const resolvedDraftNetwork = draftNetwork ? normalizeNetwork(draftNetwork, "network") : routeNetwork;

  if (routeNetwork && resolvedDraftNetwork && routeNetwork !== resolvedDraftNetwork) {
    throw new CreatePageValidationError(
      "wrong_network",
      `Wallet network ${routeNetwork} does not match draft network ${resolvedDraftNetwork}`,
      "network",
    );
  }

  const serverDraftId = coerceString(context.draft?.id ?? context.draft?.draftId);
  if (serverDraftId === undefined && draftId) {
    throw new CreatePageValidationError("malformed_response", "Draft response missing id", "id");
  }

  const draftOwner = coerceString(context.draft?.owner ?? context.draft?.walletAddress ?? context.draft?.address);
  if (!draftOwner) {
    throw new CreatePageValidationError(
      "malformed_response",
      "Draft response missing owner address",
      "owner",
    );
  }

  if (draftOwner !== walletAddress) {
    throw new CreatePageValidationError(
      "unauthorized",
      "Connected wallet does not own the draft being resumed",
      "walletAddress",
    );
  }

  const draftToken = coerceString(context.draft?.token ?? context.draft?.integrity);
  if (context.routeToken && !draftToken) {
    throw new CreatePageValidationError("malformed_response", "Draft response missing integrity token", "resumeToken");
  }

  if (context.routeToken && context.draft?.token && context.routeToken !== context.draft.token) {
    throw new CreatePageValidationError("invalid_route", "Draft route token does not match the server response", "resumeToken");
  }

  if (context.routeToken && context.draft?.integrity && context.routeToken !== context.draft.integrity) {
    throw new CreatePageValidationError("invalid_route", "Draft integrity marker does not match the route", "resumeToken");
  }

  if (serverDraftId && serverDraftId !== draftId) {
    throw new CreatePageValidationError("invalid_route", "draftId in route does not match the server draft", "draftId");
  }

  const amount = validateNumericAmount(context.draft?.amount ?? context.draft?.value, "amount", {
    min: 0,
    max: Number.MAX_SAFE_INTEGER,
  });

  return {
    draftId,
    walletAddress,
    network: resolvedDraftNetwork ?? routeNetwork ?? "TESTNET",
    amount,
  };
};

export const validateCreatePageRequest = (input: ValidationContext) => {
  if (!input) {
    throw new CreatePageValidationError("invalid_route", "Missing page request data", "request");
  }
  return assertAuthorizedDraftAccess(input);
};
