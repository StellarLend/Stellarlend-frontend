import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TransactionFilter } from './filters';
import {
  PRESETS_SCHEMA_VERSION,
  PRESETS_STORAGE_KEY,
  applyFilterToParams,
  areFiltersEqual,
  createEmptyStore,
  createPreset,
  describeFilter,
  filterFromSearchParams,
  filterToQueryString,
  findActivePreset,
  findPresetByName,
  isDuplicatePresetName,
  isFilterEmpty,
  isStorageAvailable,
  loadPresets,
  migratePresetStore,
  normalizePresetName,
  parsePresets,
  sanitizeFilter,
  savePresets,
  serializePresets,
  type FilterPreset,
} from './presets';

function makePreset(overrides: Partial<FilterPreset> = {}): FilterPreset {
  return {
    id: 'preset-1',
    name: 'Borrows',
    filter: { type: 'borrow' },
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & {
  data: Map<string, string>;
} {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

function throwingStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  return {
    getItem: () => {
      throw new DOMException('SecurityError');
    },
    setItem: () => {
      throw new DOMException('QuotaExceededError');
    },
    removeItem: () => {},
  };
}

describe('sanitizeFilter', () => {
  it('keeps only known, non-empty string keys', () => {
    expect(
      sanitizeFilter({
        type: 'borrow',
        status: 'Failed',
        asset: ' XLM ',
        fromDate: '2024-01-01',
        toDate: '',
        search: '   ',
        page: '3',
        nested: { evil: true },
        count: 7,
      })
    ).toEqual({
      type: 'borrow',
      status: 'Failed',
      asset: 'XLM',
      fromDate: '2024-01-01',
    });
  });

  it('returns an empty filter for non-object input', () => {
    expect(sanitizeFilter(null)).toEqual({});
    expect(sanitizeFilter(undefined)).toEqual({});
    expect(sanitizeFilter('type=borrow')).toEqual({});
  });
});

describe('isFilterEmpty', () => {
  it('detects filters with no usable values', () => {
    expect(isFilterEmpty({})).toBe(true);
    expect(isFilterEmpty({ search: '  ' })).toBe(true);
    expect(isFilterEmpty({ type: 'lend' })).toBe(false);
  });
});

describe('normalizePresetName', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizePresetName('  Borrows   last  30 days ')).toBe('Borrows last 30 days');
    expect(normalizePresetName('\n\t')).toBe('');
  });
});

describe('name lookups', () => {
  const presets = [makePreset(), makePreset({ id: 'preset-2', name: 'Lends' })];

  it('finds presets case-insensitively', () => {
    expect(findPresetByName(presets, ' bOrRoWs ')?.id).toBe('preset-1');
    expect(findPresetByName(presets, 'missing')).toBeUndefined();
  });

  it('flags duplicates but ignores the preset being renamed', () => {
    expect(isDuplicatePresetName(presets, 'lends')).toBe(true);
    expect(isDuplicatePresetName(presets, 'Lends', 'preset-2')).toBe(false);
    expect(isDuplicatePresetName(presets, 'Lends', 'preset-1')).toBe(true);
    expect(isDuplicatePresetName(presets, 'Repays')).toBe(false);
  });
});

describe('createPreset', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes the name, sanitizes the filter and stamps metadata', () => {
    const preset = createPreset(
      '  Big  Borrows ',
      { type: 'borrow', page: '2' } as unknown as TransactionFilter
    );

    expect(preset.name).toBe('Big Borrows');
    expect(preset.filter).toEqual({ type: 'borrow' });
    expect(preset.id).toBeTruthy();
    expect(Date.parse(preset.createdAt)).not.toBeNaN();
  });

  it('generates unique ids', () => {
    const ids = new Set(
      Array.from({ length: 20 }, () => createPreset('n', { type: 'lend' }).id)
    );
    expect(ids.size).toBe(20);
  });

  it('falls back to a generated id when crypto.randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', undefined);
    expect(createPreset('n', { type: 'lend' }).id).toMatch(/^preset-/);

    vi.stubGlobal('crypto', {});
    expect(createPreset('n', { type: 'lend' }).id).toMatch(/^preset-/);
  });
});

describe('serializePresets / parsePresets', () => {
  it('round-trips a versioned payload', () => {
    const presets = [makePreset()];
    expect(parsePresets(serializePresets(presets))).toEqual({
      version: PRESETS_SCHEMA_VERSION,
      presets,
    });
  });

  it('returns an empty store for missing input', () => {
    expect(parsePresets(null)).toEqual(createEmptyStore());
    expect(parsePresets(undefined)).toEqual(createEmptyStore());
    expect(parsePresets('')).toEqual(createEmptyStore());
  });

  it('tolerates corrupt JSON', () => {
    expect(parsePresets('{not json')).toEqual(createEmptyStore());
    expect(parsePresets('[[[')).toEqual(createEmptyStore());
  });

  it('tolerates JSON of the wrong shape', () => {
    expect(parsePresets('"a string"')).toEqual(createEmptyStore());
    expect(parsePresets('42')).toEqual(createEmptyStore());
    expect(parsePresets('null')).toEqual(createEmptyStore());
    expect(parsePresets('{"version":1}')).toEqual(createEmptyStore());
    expect(parsePresets('{"version":1,"presets":"nope"}')).toEqual(createEmptyStore());
  });
});

describe('migratePresetStore', () => {
  it('upgrades a legacy bare array to the current version', () => {
    const store = migratePresetStore([{ id: 'a', name: 'Legacy', filter: { type: 'repay' } }]);

    expect(store.version).toBe(PRESETS_SCHEMA_VERSION);
    expect(store.presets).toEqual([
      {
        id: 'a',
        name: 'Legacy',
        filter: { type: 'repay' },
        createdAt: new Date(0).toISOString(),
      },
    ]);
  });

  it('rewrites an unknown future version to the current one', () => {
    const store = migratePresetStore({ version: 99, presets: [makePreset()] });
    expect(store.version).toBe(PRESETS_SCHEMA_VERSION);
    expect(store.presets).toHaveLength(1);
  });

  it('drops entries that are unusable', () => {
    const store = migratePresetStore({
      version: 1,
      presets: [
        null,
        'nope',
        { id: 'no-name' },
        { id: 'blank', name: '   ' },
        { name: 'No id', filter: { type: 'lend' } },
      ],
    });

    expect(store.presets).toHaveLength(1);
    expect(store.presets[0]).toMatchObject({ name: 'No id', filter: { type: 'lend' } });
    expect(store.presets[0].id).toBeTruthy();
  });

  it('de-duplicates by id and by name', () => {
    const store = migratePresetStore({
      version: 1,
      presets: [
        { id: 'a', name: 'One', filter: {} },
        { id: 'a', name: 'Two', filter: {} },
        { id: 'b', name: 'one', filter: {} },
        { id: 'c', name: 'Three', filter: {} },
      ],
    });

    expect(store.presets.map((preset) => preset.name)).toEqual(['One', 'Three']);
  });
});

describe('storage helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads and saves through an injected storage', () => {
    const storage = memoryStorage();

    expect(savePresets([makePreset()], storage)).toBe(true);
    expect(storage.data.get(PRESETS_STORAGE_KEY)).toContain('"version":1');
    expect(loadPresets(storage)).toEqual([makePreset()]);
  });

  it('reports storage as available when a probe round-trips', () => {
    expect(isStorageAvailable(memoryStorage())).toBe(true);
  });

  it('treats a throwing storage as unavailable', () => {
    const storage = throwingStorage();

    expect(isStorageAvailable(storage)).toBe(false);
    expect(savePresets([makePreset()], storage)).toBe(false);
    expect(loadPresets(storage)).toEqual([]);
  });

  it('falls back to window.localStorage when no storage is passed', () => {
    window.localStorage.clear();

    expect(savePresets([makePreset()])).toBe(true);
    expect(loadPresets()).toEqual([makePreset()]);
    expect(isStorageAvailable()).toBe(true);

    window.localStorage.clear();
  });

  it('degrades gracefully when there is no window (server render)', () => {
    vi.stubGlobal('window', undefined);

    expect(isStorageAvailable(null)).toBe(false);
    expect(loadPresets(null)).toEqual([]);
    expect(savePresets([makePreset()], null)).toBe(false);
  });

  it('degrades gracefully when reading window.localStorage throws', () => {
    vi.stubGlobal('window', {
      get localStorage(): Storage {
        throw new DOMException('SecurityError');
      },
    });

    expect(isStorageAvailable()).toBe(false);
    expect(loadPresets()).toEqual([]);
    expect(savePresets([makePreset()])).toBe(false);
  });
});

describe('filterFromSearchParams', () => {
  it('parses a valid URL through the shared validator', () => {
    expect(
      filterFromSearchParams(
        new URLSearchParams('type=borrow&status=Completed&asset=xlm&fromDate=2024-01-01&search=abc&page=2')
      )
    ).toEqual({
      type: 'borrow',
      status: 'Completed',
      asset: 'XLM',
      fromDate: '2024-01-01',
      search: 'abc',
    });
  });

  it('falls back to a sanitized read when a value is invalid', () => {
    expect(filterFromSearchParams(new URLSearchParams('type=nonsense&asset=XLM'))).toEqual({
      type: 'nonsense',
      asset: 'XLM',
    });
  });

  it('returns an empty filter for an unfiltered URL', () => {
    expect(filterFromSearchParams(new URLSearchParams('page=2'))).toEqual({});
  });
});

describe('filterToQueryString / areFiltersEqual', () => {
  it('is independent of key order', () => {
    expect(filterToQueryString({ asset: 'XLM', type: 'borrow' })).toBe(
      filterToQueryString({ type: 'borrow', asset: 'XLM' })
    );
    expect(areFiltersEqual({ asset: 'XLM', type: 'borrow' }, { type: 'borrow', asset: 'XLM' })).toBe(
      true
    );
  });

  it('distinguishes different filters', () => {
    expect(areFiltersEqual({ type: 'borrow' }, { type: 'lend' })).toBe(false);
    expect(areFiltersEqual({ type: 'borrow' }, {})).toBe(false);
  });

  it('ignores blank values', () => {
    expect(areFiltersEqual({ type: 'borrow', search: '' }, { type: 'borrow' })).toBe(true);
  });
});

describe('applyFilterToParams', () => {
  it('overwrites preset params, keeps unrelated ones and resets the page', () => {
    const params = applyFilterToParams(
      new URLSearchParams('page=5&sort=amount&status=Failed'),
      { type: 'borrow', asset: 'XLM' }
    );

    expect(params.toString()).toBe('sort=amount&type=borrow&asset=XLM');
  });

  it('clears every preset param for an empty filter', () => {
    const params = applyFilterToParams(
      new URLSearchParams('type=borrow&status=Failed&asset=XLM&fromDate=2024-01-01&toDate=2024-02-01&search=a'),
      {}
    );

    expect(params.toString()).toBe('');
  });

  it('does not mutate the params it was given', () => {
    const original = new URLSearchParams('type=lend');
    applyFilterToParams(original, { type: 'borrow' });
    expect(original.toString()).toBe('type=lend');
  });
});

describe('findActivePreset', () => {
  const presets = [
    makePreset({ filter: { type: 'borrow', asset: 'XLM' } }),
    makePreset({ id: 'preset-2', name: 'Lends', filter: { type: 'lend' } }),
  ];

  it('matches on filter equality', () => {
    expect(findActivePreset(presets, { asset: 'XLM', type: 'borrow' })?.id).toBe('preset-1');
    expect(findActivePreset(presets, { type: 'lend' })?.id).toBe('preset-2');
  });

  it('returns undefined for an empty or unmatched filter', () => {
    expect(findActivePreset(presets, {})).toBeUndefined();
    expect(findActivePreset(presets, { type: 'repay' })).toBeUndefined();
    expect(findActivePreset([], { type: 'lend' })).toBeUndefined();
  });
});

describe('describeFilter', () => {
  it('summarizes populated fields in a stable order', () => {
    expect(
      describeFilter({ asset: 'XLM', type: 'borrow', fromDate: '2024-01-01', search: 'abc' })
    ).toBe('Type: borrow · Asset: XLM · From: 2024-01-01 · Search: abc');
    expect(describeFilter({ status: 'Failed', toDate: '2024-02-01' })).toBe(
      'Status: Failed · To: 2024-02-01'
    );
  });

  it('describes an empty filter', () => {
    expect(describeFilter({})).toBe('No filters');
  });
});

describe('constants', () => {
  it('exposes a versioned storage key', () => {
    expect(PRESETS_STORAGE_KEY).toContain(`v${PRESETS_SCHEMA_VERSION}`);
  });
});

describe('beforeEach isolation guard', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts with no persisted presets', () => {
    expect(loadPresets()).toEqual([]);
  });
});
