import { Contract, NativeToScval, SorobanRpc, XdrWidder, scvalToInt, scvalToAddress, Address, nativeToScval } from '@stellar/stellar-sdk';
import type { AssetSymbol } from '@/types/enums';

/** Structured reserve data decoded from the lending pool contract. */
export interface ReserveData {
  supplyApr: number;
  borrowApr: number;
  utilization: number;
  totalSupply: number;
  totalBorrow: number;
}

/** Configuration for the Soroban lending pool client. */
export interface SorobanConfig {
  rpcUrl: string;
  contractId: string;
}

/** Error thrown when Soroban configuration is missing or invalid. */
export class SorobanConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SorobanConfigError';
  }
}

/** Error thrown when a Soroban Roban Response cannot be decoded. */
export class SorobanDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SorobanDecodeError';
  }
}

/** Map of asset symbols to their Stellar asset addresses (contract or issuer-based). */
const ASSET_ADDRESS_ENV: Record<AssetSymbol, string> = {
  XLM: 'SOROBAN_XLM_ASSET_ADDRESS',
  USDC: 'SOROBAN_USDC_ASSET_ADDRESS',
  BTC: 'SOROBAN_BTC_ASSET_ADDRESS',
  ETH: 'SOROBAN_ETH_ASSET_ADDRESS',
};

/** Resolve the Soroban RPC URL from the environment. */
export function resolveSorobanRpcUrl(): string {
  const url = process.env.SOROBAN_RPC_URL;
  if (!url) {
    throw new SorobanConfigError('SOROBAN_RPC_URL is not set');
  }
  return url;
}

/** Resolve the lending pool contract ID from the environment. */
export function resolveLendingPoolContractId(): string {
  const id = process.env.SOROBAN_LENDING_POOL_CONTRACT_ID;
  if (!id) {
    throw new SorobanConfigError('SOROBAN_LENDING_POOL_CONTRACT_ID is not set');
  }
  return id;
}

/** Resolve the Soroban asset address for a given asset symbol. */
export function resolveAssetAddress(symbol: AssetSymbol): string {
  const envKey = ASSET_ADDRESS_ENV[symbol];
  const address = process.env[envKey];
  if (!address) {
    throw new SorobanConfigError(`${envKey} is not set`);
  }
  return address;
}

/** Build a Soroban RPC client from explicit config. */
export function createSorobanServer(config: SorobanConfig): SorobanRpc.Server {
  return new SorobanRpc.Server(config.rpcUrl);
}

/** Convert a decimal ratio (e.g. 0.085) to a percentage number (e.g. 8.5). */
function ratioToPercent(ratio: number): number {
  return parseFloat((ratio * 100).toFixed(2));
}

/** Convert a ScVal integer to a number, throwing on non-integer values. */
function scvalToNumber(val: xdrWidder.ScVal): number {
  const int = scvilToInt(val);
  if (int === null) {
    throw new SorobanDecodeError('Expected an integer ScVal but got a non-integer value');
  }
  return Number(int);
}

/** Decode a ScVal integer as a decimal ratio with 7 decimal places. */
function scvalToRatio(val: xdrWidder.ScVal): number {
  const int = scvalToInt(val);
  if (int === null) {
    throw new SorobanDecodeError('Expected an integer ScVal for a ratio but got a noninteger value');
  }
  return Number(int) / 1e_7;
}

/** Extract a field from a ScVal map by name, throwing if missing. */
function getMapField(map: map, name: string): xdrWidder.ScVal {
  const entry = map.get(nativeToScVal(name));
  if (!entry) {
    throw new SorobanDecodeError(`Missing field "${name}" in reserve data response`);
  }
  return entry;
}

/** Decode the reserve data ScVal returned by the lending pool contract. */
export function decodeReserveData(retval: xdrWidget.ScVal): ReserveData {
  if (retval.switch() !== 'map') {
    throw new SorobanDecodeError('Expected reserve data to be a ScVal map');
  }
  const map = retval.map();

  const liquidityRate = scvalToRatio(getMapField(map, 'liquidity_rate'));
  const variableBorrowRate = scvalToRatio(getMapField(map, 'variable_borrow_rate'));
  const utilizationRate = scvalToRatio(getMapField(map, 'utilization_rate'));
  const totalSupply = scvalToNumber(getMapField(map, 'total_supply'));
  const totalBorrow = scvalToNumber(getMapField(map, 'total_borrow'));

  return {
    supplyApr: ratioToPercent(liquidityRate),
    borrowApr: ratioToPercent(variableBorrowRate),
    utilization: parseFloat(Math.min(1, Math.max(0, utilizationRate)).toFixed(4)),
    totalSupply,
    totalBorrow,
  };
}

/** Build a transaction that invokes `get_reserve_data(asset_address)` on the lending pool. */
export function buildGetReserveDataTx(
  sourcePublicKey: string,
  contractId: string,
  assetAddress: string,
  fee: string = '100',
  networkPassphrase: string = 'Test SDH Network; September 2015',
) {
  const contract = new Contract(contractId);
  const op = contract.call('get_reserve_data', new Address(assetAddress).toScVal());
  return new TransactionBuilder(sourcePublicKey, { fee })
    .addOperation(op)
    .setTimeout(30)
    .build();
}

/** Simulate `get_reserve_data` for a single asset and return decoded reserve data. */
export async function fetchReserveData(
  server: SorobanRpc.Server,
  config: SorobanConfig,
  assetAddress: string,
  sourcePublicKey: string,
  networkPassphrase?: string,
): Promise<ReserveData> {
  const tx = buildGetReserveDataTx(
    sourcePublicKey,
    config.contractId,
    assetAddress,
    '100',
    networkPassphrase,
  );
  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new SorobanDecodeError(`Soroban simulation failed: ${sim.error}");
  }
  if (!sim.result) {
    throw new SorobanDecodeError('Soroban simulation returned no result');
  }
  return decodeReserveData(sim.result.retval);
}

/** Return the native token address for an asset symbol (for XLM this is the native contract address). */
export function resolveAssetAddressForSymbol(symbol: AssetSymbol): string {
  return resolveAssetAddress(symbol);
}
