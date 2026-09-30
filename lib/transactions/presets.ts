import {
  parseTransactionFilter,
  serializeTransactionFilters,
  type TransactionFilter,
} from './filters';

/**
 * Versioned localStorage key. Bump the suffix whenever the persisted shape
 * changes in a way `migratePresetStore` cannot recover from.
 */
export const PRESETS_STORAGE_KEY = 'stellarlend:transaction-filter-presets:v1';

/** Schema version written into every payload we persist. */
export const PRESETS_SCHEMA_VERSION = 1;

/** Query params owned by a preset — applying one always rewrites all of them. */
export const PRESET_FILTER_KEYS = [
  'type',
  'status',
  'asset',
  'fromDate',
  'toDate',
  'search',
] as const;

export interface FilterPreset {
  id: string;
  name: string;
  filter: TransactionFilter;
  createdAt: string;
}

export interface PresetStore {
  version: number;
  presets: FilterPreset[];
}

/** Minimal slice of the Storage API the helpers need. */
export type PresetStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function createEmptyStore(): PresetStore {
  return { version: PRESETS_SCHEMA_VERSION, presets: [] };
}

/**
 * Keeps only the known filter keys, discarding blank and non-string values so a
 * hand-edited payload can never smuggle extra query params into the URL.
 */
export function sanitizeFilter(value: unknown): TransactionFilter {
  const filter: TransactionFilter = {};
  if (!value || typeof value !== 'object') return filter;

  const source = value as Record<string, unknown>;
  const target = filter as Record<string, string>;
  for (const key of PRESET_FILTER_KEYS) {
    const raw = source[key];
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (trimmed) target[key] = trimmed;
  }

  return filter;
}

export function isFilterEmpty(filter: TransactionFilter): boolean {
  return Object.keys(sanitizeFilter(filter)).length === 0;
}

/** Collapses surrounding/inner whitespace so " Borrows  30d " and "Borrows 30d" collide. */
export function normalizePresetName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

export function findPresetByName(
  presets: FilterPreset[],
  name: string
): FilterPreset | undefined {
  const target = normalizePresetName(name).toLowerCase();
  return presets.find((preset) => preset.name.toLowerCase() === target);
}

/**
 * Case-insensitive duplicate check. `exceptId` lets a rename keep its own name
 * (or only change its casing) without tripping the guard.
 */
export function isDuplicatePresetName(
  presets: FilterPreset[],
  name: string,
  exceptId?: string
): boolean {
  const match = findPresetByName(presets, name);
  return Boolean(match && match.id !== exceptId);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function generateId(): string {
  const cryptoRef: Crypto | undefined = globalThis.crypto;
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return cryptoRef.randomUUID();
  }
  return `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createPreset(name: string, filter: TransactionFilter): FilterPreset {
  return {
    id: generateId(),
    name: normalizePresetName(name),
    filter: sanitizeFilter(filter),
    createdAt: new Date().toISOString(),
  };
}

/** Drops entries that lost their id/name, and de-duplicates by id and by name. */
function sanitizePresets(value: unknown): FilterPreset[] {
  if (!Array.isArray(value)) return [];

  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const presets: FilterPreset[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const candidate = entry as Record<string, unknown>;
    if (!isNonEmptyString(candidate.name)) continue;

    const id = isNonEmptyString(candidate.id) ? candidate.id : generateId();
    const name = normalizePresetName(candidate.name);
    const nameKey = name.toLowerCase();
    if (seenIds.has(id) || seenNames.has(nameKey)) continue;

    seenIds.add(id);
    seenNames.add(nameKey);
    presets.push({
      id,
      name,
      filter: sanitizeFilter(candidate.filter),
      createdAt: isNonEmptyString(candidate.createdAt)
        ? candidate.createdAt
        : new Date(0).toISOString(),
    });
  }

  return presets;
}

/**
 * Accepts any historical payload shape and returns a current-version store.
 * A bare array is the pre-versioning (v0) layout written before this helper
 * existed; anything unrecognisable degrades to an empty store.
 */
export function migratePresetStore(value: unknown): PresetStore {
  if (Array.isArray(value)) {
    return { version: PRESETS_SCHEMA_VERSION, presets: sanitizePresets(value) };
  }

  if (!value || typeof value !== 'object') return createEmptyStore();

  const source = value as Record<string, unknown>;
  return {
    version: PRESETS_SCHEMA_VERSION,
    presets: sanitizePresets(source.presets),
  };
}

export function serializePresets(presets: FilterPreset[]): string {
  return JSON.stringify({ version: PRESETS_SCHEMA_VERSION, presets });
}

/** Never throws: corrupt JSON is treated as "no presets saved yet". */
export function parsePresets(raw: string | null | undefined): PresetStore {
  if (!raw) return createEmptyStore();

  try {
    return migratePresetStore(JSON.parse(raw));
  } catch {
    return createEmptyStore();
  }
}

function resolveStorage(storage?: PresetStorage | null): PresetStorage | null {
  if (storage) return storage;
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    // Accessing localStorage itself can throw when cookies/storage are blocked.
    return null;
  }
}

export function isStorageAvailable(storage?: PresetStorage | null): boolean {
  const target = resolveStorage(storage);
  if (!target) return false;

  const probeKey = `${PRESETS_STORAGE_KEY}:probe`;
  try {
    target.setItem(probeKey, '1');
    target.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

export function loadPresets(storage?: PresetStorage | null): FilterPreset[] {
  const target = resolveStorage(storage);
  if (!target) return [];

  try {
    return parsePresets(target.getItem(PRESETS_STORAGE_KEY)).presets;
  } catch {
    return [];
  }
}

/** Returns false when the write was rejected (private mode, quota exceeded). */
export function savePresets(
  presets: FilterPreset[],
  storage?: PresetStorage | null
): boolean {
  const target = resolveStorage(storage);
  if (!target) return false;

  try {
    target.setItem(PRESETS_STORAGE_KEY, serializePresets(presets));
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads the current filter out of URL params. Uses the strict validator from
 * `filters.ts` so a preset captures exactly what the API would accept, and
 * falls back to a sanitized read when the URL holds an invalid value.
 */
export function filterFromSearchParams(params: URLSearchParams): TransactionFilter {
  const result = parseTransactionFilter(params);
  if (result.valid) return result.filter;

  const raw: Record<string, string> = {};
  for (const key of PRESET_FILTER_KEYS) {
    const value = params.get(key);
    if (value !== null) raw[key] = value;
  }
  return sanitizeFilter(raw);
}

/** Stable, order-independent serialisation used for equality checks. */
export function filterToQueryString(filter: TransactionFilter): string {
  const params = serializeTransactionFilters(sanitizeFilter(filter));
  params.sort();
  return params.toString();
}

export function areFiltersEqual(a: TransactionFilter, b: TransactionFilter): boolean {
  return filterToQueryString(a) === filterToQueryString(b);
}

/**
 * Rewrites the preset-owned params on top of `current`, preserving unrelated
 * ones (e.g. sort) and resetting pagination.
 */
export function applyFilterToParams(
  current: URLSearchParams,
  filter: TransactionFilter
): URLSearchParams {
  const params = new URLSearchParams(current.toString());
  const next = sanitizeFilter(filter);

  for (const key of PRESET_FILTER_KEYS) {
    const value = next[key];
    if (value) params.set(key, value);
    else params.delete(key);
  }

  params.delete('page');
  return params;
}

/** The preset whose filter matches the URL, if any. */
export function findActivePreset(
  presets: FilterPreset[],
  filter: TransactionFilter
): FilterPreset | undefined {
  if (isFilterEmpty(filter)) return undefined;
  return presets.find((preset) => areFiltersEqual(preset.filter, filter));
}

/** Human-readable "Type: borrow · Asset: XLM" summary for the preset row. */
export function describeFilter(filter: TransactionFilter): string {
  const labels: Record<(typeof PRESET_FILTER_KEYS)[number], string> = {
    type: 'Type',
    status: 'Status',
    asset: 'Asset',
    fromDate: 'From',
    toDate: 'To',
    search: 'Search',
  };

  const next = sanitizeFilter(filter);
  const parts = PRESET_FILTER_KEYS.filter((key) => next[key]).map(
    (key) => `${labels[key]}: ${next[key]}`
  );

  return parts.length ? parts.join(' · ') : 'No filters';
}
