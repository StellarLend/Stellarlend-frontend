import {
  Account,
  Address,
  Contract,
  Keypair,
  TimeoutInfinite,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";
import type { xdr } from "@stellar/stellar-sdk";
import { config } from "@/lib/config";

const SIMULATION_SOURCE = "GA5WUJ54Z23KILLCUOUNAKTPBVZWKMQVO4O6EQ5GHLAERIMLLHNCSKYH";

export type PositionSummary = {
  collateral: bigint;
  debt: bigint;
  healthFactor?: bigint;
  [key: string]: unknown;
};

export type ProtocolMetrics = {
  totalSupply: bigint;
  totalBorrow: bigint;
  [key: string]: unknown;
};

export type PauseType = "All" | "Deposit" | "Borrow" | "Repay" | "Withdraw" | "Liquidate" | "FlashLoan";

function getRpcServer(rpcUrl?: string): rpc.Server {
  return new rpc.Server(rpcUrl || config.rpc, {
    allowHttp: (rpcUrl || config.rpc).startsWith("http://"),
  });
}

export function pauseTypeToScVal(pauseType: PauseType, asVec = false): xdr.ScVal {
  if (asVec) {
    return nativeToScVal([pauseType], { type: ["symbol"] });
  }
  return nativeToScVal(pauseType, { type: "symbol" });
}

export async function readContract(
  method: string,
  args: xdr.ScVal[] = [],
  contractId = config.lendingId,
  rpcUrl = config.rpc,
  networkPassphrase = config.networkPassphrase
): Promise<unknown> {
  const server = getRpcServer(rpcUrl);
  const tx = new TransactionBuilder(new Account(SIMULATION_SOURCE, "0"), {
    fee: "100",
    networkPassphrase,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();

  const result = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(result)) {
    throw new Error(`Simulation error calling ${method}: ${result.error}`);
  }
  if (!result.result) {
    throw new Error(`RPC simulation returned no result for ${method}`);
  }
  return scValToNative(result.result.retval);
}

export async function get_position(
  userAddress: string,
  contractId = config.lendingId,
  rpcUrl = config.rpc
): Promise<PositionSummary> {
  const userScVal = new Address(userAddress).toScVal();
  const raw = await readContract("get_position", [userScVal], contractId, rpcUrl);

  if (typeof raw === "object" && raw !== null) {
    const r = raw as Record<string, unknown>;
    const collateral =
      typeof r.collateral === "bigint"
        ? r.collateral
        : typeof r.collateral_amount === "bigint"
        ? r.collateral_amount
        : typeof r.total_collateral === "bigint"
        ? r.total_collateral
        : BigInt(String(r.collateral || 0));

    const debt =
      typeof r.debt === "bigint"
        ? r.debt
        : typeof r.debt_amount === "bigint"
        ? r.debt_amount
        : typeof r.total_debt === "bigint"
        ? r.total_debt
        : BigInt(String(r.debt || 0));

    return {
      collateral,
      debt,
      ...r,
    };
  }

  throw new Error(`Unexpected get_position response format: ${JSON.stringify(raw)}`);
}

export async function get_health_factor(
  userAddress: string,
  contractId = config.lendingId,
  rpcUrl = config.rpc
): Promise<bigint> {
  const userScVal = new Address(userAddress).toScVal();
  const raw = await readContract("get_health_factor", [userScVal], contractId, rpcUrl);
  if (typeof raw === "bigint") {
    return raw;
  }
  if (typeof raw === "number") {
    return BigInt(Math.trunc(raw));
  }
  if (typeof raw === "string") {
    return BigInt(raw);
  }
  throw new Error(`Unexpected get_health_factor response format: ${JSON.stringify(raw)}`);
}

export async function get_protocol_metrics(
  contractId = config.lendingId,
  rpcUrl = config.rpc
): Promise<ProtocolMetrics> {
  const raw = await readContract("get_protocol_metrics", [], contractId, rpcUrl);
  if (typeof raw === "object" && raw !== null) {
    const r = raw as Record<string, unknown>;
    const totalSupply =
      typeof r.total_supply === "bigint"
        ? r.total_supply
        : typeof r.totalSupply === "bigint"
        ? r.totalSupply
        : BigInt(String(r.total_supply || 0));

    const totalBorrow =
      typeof r.total_borrow === "bigint"
        ? r.total_borrow
        : typeof r.totalBorrow === "bigint"
        ? r.totalBorrow
        : BigInt(String(r.total_borrow || 0));

    return {
      totalSupply,
      totalBorrow,
      ...r,
    };
  }
  throw new Error(`Unexpected get_protocol_metrics response format: ${JSON.stringify(raw)}`);
}

export async function get_pause_state(
  pauseType: PauseType = "All",
  contractId = config.lendingId,
  rpcUrl = config.rpc
): Promise<boolean> {
  try {
    const res = await readContract("get_pause_state", [pauseTypeToScVal(pauseType)], contractId, rpcUrl);
    if (typeof res === "boolean") return res;
    return Boolean(res);
  } catch {
    const res = await readContract("get_pause_state", [pauseTypeToScVal(pauseType, true)], contractId, rpcUrl);
    if (typeof res === "boolean") return res;
    return Boolean(res);
  }
}

export async function set_pause(
  adminKeypair: Keypair,
  pauseType: PauseType,
  paused: boolean,
  contractId = config.lendingId,
  rpcUrl = config.rpc,
  networkPassphrase = config.networkPassphrase
): Promise<string> {
  const server = getRpcServer(rpcUrl);
  const adminAccount = await server.getAccount(adminKeypair.publicKey());

  let pauseArg = pauseTypeToScVal(pauseType);
  try {
    const tx = new TransactionBuilder(adminAccount, { fee: "10000", networkPassphrase })
      .addOperation(
        new Contract(contractId).call("set_pause", new Address(adminKeypair.publicKey()).toScVal(), pauseArg, nativeToScVal(paused))
      )
      .setTimeout(TimeoutInfinite)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      pauseArg = pauseTypeToScVal(pauseType, true);
    }
  } catch {
    pauseArg = pauseTypeToScVal(pauseType, true);
  }

  const preparedTx = await server.prepareTransaction(
    new TransactionBuilder(adminAccount, { fee: "10000", networkPassphrase })
      .addOperation(
        new Contract(contractId).call("set_pause", new Address(adminKeypair.publicKey()).toScVal(), pauseArg, nativeToScVal(paused))
      )
      .setTimeout(TimeoutInfinite)
      .build()
  );

  preparedTx.sign(adminKeypair);
  const sendRes = await server.sendTransaction(preparedTx);
  if (sendRes.status === "ERROR") {
    throw new Error(`Failed to send set_pause transaction: ${JSON.stringify(sendRes)}`);
  }

  let status = await server.getTransaction(sendRes.hash);
  let attempts = 0;
  while (status.status === "NOT_FOUND" && attempts < 20) {
    await new Promise((r) => setTimeout(r, 1000));
    status = await server.getTransaction(sendRes.hash);
    attempts++;
  }

  if (status.status !== "SUCCESS") {
    throw new Error(`set_pause transaction failed with status: ${status.status}`);
  }

  return sendRes.hash;
}
