import {
  Address,
  BASE_FEE,
  Contract,
  Networks,
  rpc,
  scValToNative,
  TransactionBuilder,
  nativeToScVal,
} from "@stellar/stellar-sdk";
import { signTransaction } from "@stellar/freighter-api";
import { config } from "@/lib/config";
import { calculateBurnAmounts, calculateMintShares } from "./liquidity-math";

const NETWORK_PASSPHRASE = config.network === "public" ? Networks.PUBLIC : Networks.TESTNET;
const POLL_INTERVAL_MS = 2_000;
const TX_TIMEOUT_MS = 120_000;

export type TokenState = {
  decimals: number;
  balance: bigint;
  trustline: "active" | "missing" | "unknown";
};

export type PoolSnapshot = {
  reserveA: bigint;
  reserveB: bigint;
  totalSupply: bigint;
  minimumReserve: bigint;
  userShares: bigint;
  tokenA: TokenState;
  tokenB: TokenState;
  feeBps?: bigint;
  minSwapIn?: bigint;
  maxImpactBps?: number;
  ledger?: number | null;
  fetchedAt?: number;
};

export type LiquidityAction =
  | { kind: "add"; amountA: bigint; amountB: bigint }
  | { kind: "remove"; shares: bigint };

type HorizonAccount = { balances?: Array<Record<string, unknown>> };

function requireConfiguration(): void {
  const unset = [
    ["AMM pool", config.ammId],
    ["Token A", config.ammTokenAId],
    ["Token B", config.ammTokenBId],
  ].filter(([, id]) => !id).map(([name]) => name);
  if (unset.length) throw new Error(`AMM is not configured. Set ${unset.join(", ")} contract ID${unset.length > 1 ? "s" : ""}.`);
}

function server(): rpc.Server {
  return new rpc.Server(config.rpc);
}

async function readContract<T>(
  serverClient: rpc.Server,
  sourceAddress: string,
  contractId: string,
  method: string,
  args: ReturnType<typeof nativeToScVal>[] = [],
): Promise<T> {
  const source = await serverClient.getAccount(sourceAddress);
  const transaction = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();
  const result = await serverClient.simulateTransaction(transaction);
  if (rpc.Api.isSimulationError(result)) throw new Error(result.error);
  if (!result.result) throw new Error(`Soroban RPC did not return a value for ${method}.`);
  return scValToNative(result.result.retval) as T;
}

function readHorizonTrustline(asset: string, account: HorizonAccount | null): TokenState["trustline"] {
  if (!asset || !account?.balances) return "unknown";
  const separator = asset.indexOf(":");
  if (separator <= 0 || separator === asset.length - 1) return "unknown";
  const code = asset.slice(0, separator);
  const issuer = asset.slice(separator + 1);
  return account.balances.some((balance) => balance.asset_code === code && balance.asset_issuer === issuer)
    ? "active"
    : "missing";
}

export async function readPool(address: string): Promise<PoolSnapshot> {
  requireConfiguration();
  const rpcServer = server();
  const user = new Address(address).toScVal();
  const horizonResponse = await fetch(`${config.horizon}/accounts/${address}`);
  let horizonAccount: HorizonAccount | null = null;
  if (horizonResponse.ok) horizonAccount = await horizonResponse.json() as HorizonAccount;
  else if (horizonResponse.status !== 404) throw new Error(`Horizon account lookup failed (${horizonResponse.status}).`);

  let latestLedger: number | null = null;
  try {
    const latest = await rpcServer.getLatestLedger();
    latestLedger = latest.sequence;
  } catch {
    // optional ledger sequence
  }

  const [
    reserves,
    totalSupply,
    userShares,
    minimumReserve,
    feeBpsVal,
    minSwapInVal,
    maxImpactBpsVal,
    decimalsA,
    decimalsB,
    balanceA,
    balanceB,
  ] = await Promise.all([
    readContract<unknown[]>(rpcServer, address, config.ammId, "get_reserves"),
    readContract<bigint>(rpcServer, address, config.ammId, "get_total_supply"),
    readContract<bigint>(rpcServer, address, config.ammId, "get_lp_balance", [user]),
    readContract<bigint>(rpcServer, address, config.ammId, "get_min_liquidity").catch(() => 0n),
    readContract<bigint | number>(rpcServer, address, config.ammId, "get_fee_bps").catch(() => 30n),
    readContract<bigint | number>(rpcServer, address, config.ammId, "get_min_swap_in").catch(() => 0n),
    readContract<number | bigint>(rpcServer, address, config.ammId, "get_max_impact_bps").catch(() => 0xffff_ffff),
    readContract<number | bigint>(rpcServer, address, config.ammTokenAId, "decimals"),
    readContract<number | bigint>(rpcServer, address, config.ammTokenBId, "decimals"),
    readContract<bigint>(rpcServer, address, config.ammTokenAId, "balance", [user]),
    readContract<bigint>(rpcServer, address, config.ammTokenBId, "balance", [user]),
  ]);
  if (!Array.isArray(reserves) || reserves.length !== 2) throw new Error("AMM returned an invalid reserve tuple.");
  const tokenDecimalsA = Number(decimalsA);
  const tokenDecimalsB = Number(decimalsB);
  if (![tokenDecimalsA, tokenDecimalsB].every((decimals) => Number.isInteger(decimals) && decimals >= 0 && decimals <= 18)) {
    throw new Error("A pool token returned invalid decimals.");
  }
  return {
    reserveA: BigInt(reserves[0] as bigint),
    reserveB: BigInt(reserves[1] as bigint),
    totalSupply: BigInt(totalSupply),
    userShares: BigInt(userShares),
    minimumReserve: BigInt(minimumReserve ?? 0n),
    feeBps: BigInt(feeBpsVal ?? 30n),
    minSwapIn: BigInt(minSwapInVal ?? 0n),
    maxImpactBps: Number(maxImpactBpsVal ?? 0xffff_ffff),
    tokenA: {
      decimals: tokenDecimalsA,
      balance: BigInt(balanceA),
      trustline: readHorizonTrustline(config.ammTokenAHorizonAsset, horizonAccount),
    },
    tokenB: {
      decimals: tokenDecimalsB,
      balance: BigInt(balanceB),
      trustline: readHorizonTrustline(config.ammTokenBHorizonAsset, horizonAccount),
    },
    ledger: latestLedger,
    fetchedAt: 1,
  };
}

export type SimulatedSwapQuote = {
  amountOut: bigint;
  fee: bigint;
  reserveAAfter: bigint;
  reserveBAfter: bigint;
};

export async function simulateSwapQuote(
  sourceAddress: string,
  amountIn: bigint,
  feeBps: bigint,
  aForB: boolean,
): Promise<SimulatedSwapQuote> {
  requireConfiguration();
  const rpcServer = server();
  const args = [
    nativeToScVal(amountIn, { type: "i128" }),
    nativeToScVal(feeBps, { type: "i128" }),
    nativeToScVal(aForB, { type: "bool" }),
  ];

  type RawQuote = {
    amount_out?: bigint;
    fee?: bigint;
    reserve_a_after?: bigint;
    reserve_b_after?: bigint;
    amountOut?: bigint;
    reserveAAfter?: bigint;
    reserveBAfter?: bigint;
  };

  const raw = await readContract<RawQuote>(
    rpcServer,
    sourceAddress,
    config.ammId,
    "get_swap_quote",
    args,
  );

  return {
    amountOut: BigInt(raw.amount_out ?? raw.amountOut ?? 0n),
    fee: BigInt(raw.fee ?? 0n),
    reserveAAfter: BigInt(raw.reserve_a_after ?? raw.reserveAAfter ?? 0n),
    reserveBAfter: BigInt(raw.reserve_b_after ?? raw.reserveBAfter ?? 0n),
  };
}

function validateAction(snapshot: PoolSnapshot, action: LiquidityAction): string | null {
  if (action.kind === "add") {
    if (action.amountA <= 0n || action.amountB <= 0n) return "Enter positive amounts for both pool tokens.";
    if (action.amountA > snapshot.tokenA.balance) return "Insufficient Token A balance for this deposit.";
    if (action.amountB > snapshot.tokenB.balance) return "Insufficient Token B balance for this deposit.";
    const preview = calculateMintShares(snapshot.totalSupply, action.amountA, action.amountB, snapshot.reserveA, snapshot.reserveB);
    if (!preview.ok) return contractErrorMessage(preview.error);
    return null;
  }

  if (action.shares <= 0n) return "Enter a positive amount of LP shares.";
  if (action.shares > snapshot.userShares) return "Insufficient LP balance for this withdrawal.";
  const preview = calculateBurnAmounts(action.shares, snapshot.totalSupply, snapshot.reserveA, snapshot.reserveB);
  if (!preview.ok) return contractErrorMessage(preview.error);
  if (snapshot.reserveA - preview.value.amountA < snapshot.minimumReserve
    || snapshot.reserveB - preview.value.amountB < snapshot.minimumReserve) {
    return "This withdrawal would leave a pool reserve below its minimum liquidity floor.";
  }
  return null;
}

function previewAmounts(snapshot: PoolSnapshot, action: LiquidityAction): bigint[] | null {
  if (action.kind === "add") {
    const preview = calculateMintShares(snapshot.totalSupply, action.amountA, action.amountB, snapshot.reserveA, snapshot.reserveB);
    return preview.ok ? [preview.value.shares] : null;
  }
  const preview = calculateBurnAmounts(action.shares, snapshot.totalSupply, snapshot.reserveA, snapshot.reserveB);
  return preview.ok ? [preview.value.amountA, preview.value.amountB] : null;
}

export function previewMovementPercent(previous: PoolSnapshot, current: PoolSnapshot, action: LiquidityAction): number {
  const before = previewAmounts(previous, action);
  const after = previewAmounts(current, action);
  if (before === null || after === null) return before === after ? 0 : 100;
  return Math.max(...before.map((oldAmount, index) => {
    const newAmount = after[index];
    if (oldAmount === 0n) return newAmount === 0n ? 0 : 100;
    const difference = oldAmount > newAmount ? oldAmount - newAmount : newAmount - oldAmount;
    return Number(difference * 1_000_000n / oldAmount) / 10_000;
  }));
}

export function contractErrorMessage(message: string): string {
  const readable: Array<[string, number, string]> = [
    ["InsufficientLiquidityMinted", 9, "This deposit is too small to mint any LP shares."],
    ["InsufficientLpBalance", 14, "You do not have enough LP shares for this withdrawal."],
    ["BelowMinLiquidity", 17, "This withdrawal would leave the pool below its minimum reserve floor."],
    ["ReentrantFlashSwap", 6, "The pool is temporarily locked by an active flash swap."],
    ["ZeroReserve", 13, "The pool has an empty reserve and cannot calculate a share preview."],
    ["InvalidBurnAmount", 12, "Enter a positive amount of LP shares."],
    ["BurnExceedsSupply", 11, "The requested LP shares exceed the pool's total supply."],
  ];
  for (const [name, code, messageText] of readable) {
    if (message.includes(name) || new RegExp(`Error\\(Contract,\\s*#?${code}\\)`).test(message)) return messageText;
  }
  if (/user rejected|rejected the request|declined|cancelled|canceled/i.test(message)) return "Transaction cancelled in Freighter.";
  return message || "The transaction failed. Please try again.";
}

function ensureCorrectNetwork(network: string | undefined, passphrase: string | undefined): void {
  const expected = config.network === "public" ? "PUBLIC" : "TESTNET";
  const expectedPassphrase = config.network === "public" ? Networks.PUBLIC : Networks.TESTNET;
  if (!network || network.toUpperCase() !== expected || passphrase !== expectedPassphrase) {
    throw new Error(`Freighter is on ${network ?? "an unknown network"}. Switch to Stellar ${expected.toLowerCase()} before signing.`);
  }
}

export async function submitLiquidityAction(
  address: string,
  action: LiquidityAction,
  previousSnapshot: PoolSnapshot,
  confirmPreviewChange: (differencePercent: number) => boolean,
): Promise<string> {
  requireConfiguration();
  const freighter = await import("@stellar/freighter-api");
  const network = await freighter.getNetwork();
  if (network.error) throw new Error(network.error.message);
  ensureCorrectNetwork(network.network, network.networkPassphrase);

  const current = await readPool(address);
  const movement = previewMovementPercent(previousSnapshot, current, action);
  if (movement > 0.5 && !confirmPreviewChange(movement)) throw new Error("Transaction cancelled because the preview changed.");
  const validation = validateAction(current, action);
  if (validation) throw new Error(validation);

  const args = action.kind === "add"
    ? [
        new Address(address).toScVal(),
        nativeToScVal(action.amountA, { type: "i128" }),
        nativeToScVal(action.amountB, { type: "i128" }),
      ]
    : [new Address(address).toScVal(), nativeToScVal(action.shares, { type: "i128" })];
  const method = action.kind === "add" ? "add_liquidity" : "remove_liquidity";
  const rpcServer = server();
  const account = await rpcServer.getAccount(address);
  const transaction = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(new Contract(config.ammId).call(method, ...args))
    .setTimeout(30)
    .build();
  const prepared = await rpcServer.prepareTransaction(transaction);
  const signed = await freighter.signTransaction(prepared.toXDR(), { networkPassphrase: NETWORK_PASSPHRASE });
  if (signed.error) throw new Error(signed.error.message);
  const signedTx = TransactionBuilder.fromXDR(signed.signedTxXdr, NETWORK_PASSPHRASE);
  const submitted = await rpcServer.sendTransaction(signedTx);
  if (submitted.status === "ERROR") throw new Error(submitted.errorResult?.toXDR("base64") ?? "Soroban RPC rejected the transaction.");

  const startedAt = Date.now();
  while (Date.now() - startedAt < TX_TIMEOUT_MS) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const status = await rpcServer.getTransaction(submitted.hash);
    if (status.status === rpc.Api.GetTransactionStatus.SUCCESS) return submitted.hash;
    if (status.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(status.resultXdr?.toXDR("base64") ?? "The Soroban transaction failed.");
    }
  }
  throw new Error(`Timed out waiting for transaction confirmation: ${submitted.hash}`);
}
