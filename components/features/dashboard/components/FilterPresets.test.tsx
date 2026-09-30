import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import FilterPresets from './FilterPresets';
import {
  PRESETS_SCHEMA_VERSION,
  PRESETS_STORAGE_KEY,
  type FilterPreset,
} from '@/lib/transactions/presets';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
  useSearchParams: vi.fn(),
}));

const PATHNAME = '/dashboard/transactions';

function makePreset(overrides: Partial<FilterPreset> = {}): FilterPreset {
  return {
    id: 'preset-1',
    name: 'Borrows',
    filter: { type: 'borrow' },
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function seedStorage(presets: FilterPreset[]) {
  window.localStorage.setItem(
    PRESETS_STORAGE_KEY,
    JSON.stringify({ version: PRESETS_SCHEMA_VERSION, presets })
  );
}

function readStorage() {
  return JSON.parse(window.localStorage.getItem(PRESETS_STORAGE_KEY) ?? 'null');
}

function setUrl(query: string) {
  (useSearchParams as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
    new URLSearchParams(query)
  );
}

describe('FilterPresets', () => {
  let mockReplace: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();

    mockReplace = vi.fn();
    (useRouter as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ replace: mockReplace });
    (usePathname as unknown as ReturnType<typeof vi.fn>).mockReturnValue(PATHNAME);
    setUrl('');
  });

  it('renders the empty state when nothing is saved', () => {
    render(<FilterPresets />);

    expect(screen.getByRole('heading', { name: /saved filters/i })).toBeInTheDocument();
    expect(screen.getByText(/no saved presets yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: /saved filter presets/i })).not.toBeInTheDocument();
  });

  it('exposes saved presets as an accessible list', () => {
    seedStorage([
      makePreset(),
      makePreset({ id: 'preset-2', name: 'Failed USDC', filter: { status: 'Failed', asset: 'USDC' } }),
    ]);

    render(<FilterPresets />);

    const list = screen.getByRole('list', { name: /saved filter presets/i });
    expect(list).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Borrows' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Failed USDC' })).toHaveAttribute(
      'title',
      'Status: Failed · Asset: USDC'
    );
    expect(screen.getByRole('button', { name: /rename preset Borrows/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete preset Borrows/i })).toBeInTheDocument();
  });

  it('saves the current filters as a named preset', () => {
    setUrl('type=borrow&fromDate=2024-01-01');

    render(<FilterPresets />);
    fireEvent.click(screen.getByRole('button', { name: /save current filters/i }));
    fireEvent.change(screen.getByLabelText(/preset name/i), {
      target: { value: '  Borrows last  30 days  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save preset/i }));

    // The new preset matches the current URL, so it renders as the active chip
    expect(screen.getByRole('button', { name: 'Borrows last 30 days' })).toHaveAttribute(
      'aria-current',
      'true'
    );
    expect(readStorage()).toEqual({
      version: PRESETS_SCHEMA_VERSION,
      presets: [
        expect.objectContaining({
          name: 'Borrows last 30 days',
          filter: { type: 'borrow', fromDate: '2024-01-01' },
        }),
      ],
    });
    // Form closes after a successful save
    expect(screen.queryByLabelText(/preset name/i)).not.toBeInTheDocument();
  });

  it('saves the preset when Enter is pressed in the name field', () => {
    setUrl('status=Completed');

    render(<FilterPresets />);
    fireEvent.click(screen.getByRole('button', { name: /save current filters/i }));
    const input = screen.getByLabelText(/preset name/i);
    fireEvent.change(input, { target: { value: 'Completed only' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByRole('button', { name: 'Completed only' })).toBeInTheDocument();
    expect(readStorage().presets).toHaveLength(1);
  });

  it('closes the create form on Escape without saving', () => {
    setUrl('type=lend');

    render(<FilterPresets />);
    fireEvent.click(screen.getByRole('button', { name: /save current filters/i }));
    const input = screen.getByLabelText(/preset name/i);
    fireEvent.change(input, { target: { value: 'Lends' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByLabelText(/preset name/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lends' })).not.toBeInTheDocument();
    expect(window.localStorage.getItem(PRESETS_STORAGE_KEY)).toBeNull();
  });

  it('ignores other keys in the name field', () => {
    setUrl('type=lend');

    render(<FilterPresets />);
    fireEvent.click(screen.getByRole('button', { name: /save current filters/i }));
    const input = screen.getByLabelText(/preset name/i);
    fireEvent.change(input, { target: { value: 'Lends' } });
    fireEvent.keyDown(input, { key: 'a' });

    expect(screen.getByLabelText(/preset name/i)).toHaveValue('Lends');
    expect(window.localStorage.getItem(PRESETS_STORAGE_KEY)).toBeNull();
  });

  it('rejects an empty preset name', () => {
    setUrl('type=borrow');

    render(<FilterPresets />);
    fireEvent.click(screen.getByRole('button', { name: /save current filters/i }));
    fireEvent.change(screen.getByLabelText(/preset name/i), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /save preset/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name for this preset.');
    expect(screen.getByLabelText(/preset name/i)).toHaveAttribute('aria-invalid', 'true');
    expect(window.localStorage.getItem(PRESETS_STORAGE_KEY)).toBeNull();
  });

  it('rejects a duplicate preset name regardless of casing', () => {
    seedStorage([makePreset({ name: 'Borrows' })]);
    setUrl('type=repay');

    render(<FilterPresets />);
    fireEvent.click(screen.getByRole('button', { name: /save current filters/i }));
    fireEvent.change(screen.getByLabelText(/preset name/i), { target: { value: 'borrows' } });
    fireEvent.click(screen.getByRole('button', { name: /save preset/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'A preset named "borrows" already exists.'
    );
    expect(readStorage().presets).toHaveLength(1);
  });

  it('refuses to save a preset with no active filters', () => {
    setUrl('page=2');

    render(<FilterPresets />);
    fireEvent.click(screen.getByRole('button', { name: /save current filters/i }));
    fireEvent.change(screen.getByLabelText(/preset name/i), { target: { value: 'Everything' } });
    fireEvent.click(screen.getByRole('button', { name: /save preset/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Apply at least one filter before saving a preset.'
    );
    expect(window.localStorage.getItem(PRESETS_STORAGE_KEY)).toBeNull();
  });

  it('applies a preset to the URL, preserving unrelated params and resetting the page', () => {
    seedStorage([makePreset({ filter: { type: 'borrow', asset: 'XLM' } })]);
    setUrl('page=3&sort=amount');

    render(<FilterPresets />);
    fireEvent.click(screen.getByRole('button', { name: 'Borrows' }));

    expect(mockReplace).toHaveBeenCalledWith(
      `${PATHNAME}?sort=amount&type=borrow&asset=XLM`,
      { scroll: false }
    );
  });

  it('clears stale filter params that the preset does not define', () => {
    seedStorage([makePreset({ filter: { type: 'borrow' } })]);
    setUrl('status=Failed&search=abc');

    render(<FilterPresets />);
    fireEvent.click(screen.getByRole('button', { name: 'Borrows' }));

    expect(mockReplace).toHaveBeenCalledWith(`${PATHNAME}?type=borrow`, { scroll: false });
  });

  it('drops the query string entirely when a preset carries no filters', () => {
    // A legacy payload can hold a preset whose filter did not survive migration
    seedStorage([makePreset({ name: 'Everything', filter: {} })]);

    render(<FilterPresets />);
    fireEvent.click(screen.getByRole('button', { name: 'Everything' }));

    expect(mockReplace).toHaveBeenCalledWith(PATHNAME, { scroll: false });
  });

  it('marks the preset matching the current URL as active', () => {
    seedStorage([
      makePreset({ filter: { type: 'borrow', asset: 'XLM' } }),
      makePreset({ id: 'preset-2', name: 'Lends', filter: { type: 'lend' } }),
    ]);
    setUrl('asset=XLM&type=borrow&page=4');

    render(<FilterPresets />);

    expect(screen.getByRole('button', { name: 'Borrows' })).toHaveAttribute(
      'aria-current',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Lends' })).not.toHaveAttribute('aria-current');
  });

  it('treats an invalid URL filter value as an unmatched filter', () => {
    seedStorage([makePreset({ filter: { type: 'borrow' } })]);
    setUrl('type=not-a-type');

    render(<FilterPresets />);

    expect(screen.getByRole('button', { name: 'Borrows' })).not.toHaveAttribute('aria-current');
  });

  it('renames a preset and persists the new name', () => {
    seedStorage([makePreset()]);

    render(<FilterPresets />);
    fireEvent.click(screen.getByRole('button', { name: /rename preset Borrows/i }));
    const input = screen.getByLabelText(/rename preset Borrows/i);
    expect(input).toHaveValue('Borrows');
    fireEvent.change(input, { target: { value: 'Borrow history' } });
    fireEvent.click(screen.getByRole('button', { name: /save new name for Borrows/i }));

    expect(screen.getByRole('button', { name: 'Borrow history' })).toBeInTheDocument();
    expect(readStorage().presets[0]).toMatchObject({
      id: 'preset-1',
      name: 'Borrow history',
      filter: { type: 'borrow' },
    });
  });

  it('renames on Enter, keeps the id stable and leaves siblings alone', () => {
    seedStorage([makePreset(), makePreset({ id: 'preset-2', name: 'Lends', filter: { type: 'lend' } })]);

    render(<FilterPresets />);
    fireEvent.click(screen.getByRole('button', { name: /rename preset Borrows/i }));
    const input = screen.getByLabelText(/rename preset Borrows/i);
    fireEvent.change(input, { target: { value: 'Renamed' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(readStorage().presets).toEqual([
      expect.objectContaining({ id: 'preset-1', name: 'Renamed' }),
      expect.objectContaining({ id: 'preset-2', name: 'Lends' }),
    ]);
  });

  it('allows a rename that only changes casing of its own name', () => {
    seedStorage([makePreset({ name: 'Borrows' })]);

    render(<FilterPresets />);
    fireEvent.click(screen.getByRole('button', { name: /rename preset Borrows/i }));
    fireEvent.change(screen.getByLabelText(/rename preset Borrows/i), {
      target: { value: 'BORROWS' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save new name for Borrows/i }));

    expect(readStorage().presets[0].name).toBe('BORROWS');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('rejects a rename that collides with another preset', () => {
    seedStorage([makePreset(), makePreset({ id: 'preset-2', name: 'Lends', filter: { type: 'lend' } })]);

    render(<FilterPresets />);
    fireEvent.click(screen.getByRole('button', { name: /rename preset Lends/i }));
    fireEvent.change(screen.getByLabelText(/rename preset Lends/i), {
      target: { value: 'Borrows' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save new name for Lends/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'A preset named "Borrows" already exists.'
    );
    expect(readStorage().presets[1].name).toBe('Lends');
  });

  it('rejects an empty rename', () => {
    seedStorage([makePreset()]);

    render(<FilterPresets />);
    fireEvent.click(screen.getByRole('button', { name: /rename preset Borrows/i }));
    fireEvent.change(screen.getByLabelText(/rename preset Borrows/i), { target: { value: ' ' } });
    fireEvent.click(screen.getByRole('button', { name: /save new name for Borrows/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name for this preset.');
    expect(readStorage().presets[0].name).toBe('Borrows');
  });

  it('cancels a rename with the cancel button and with Escape', () => {
    seedStorage([makePreset()]);

    render(<FilterPresets />);
    fireEvent.click(screen.getByRole('button', { name: /rename preset Borrows/i }));
    fireEvent.change(screen.getByLabelText(/rename preset Borrows/i), {
      target: { value: 'Discarded' },
    });
    fireEvent.click(screen.getByRole('button', { name: /cancel renaming Borrows/i }));

    expect(screen.getByRole('button', { name: 'Borrows' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /rename preset Borrows/i }));
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });

    expect(screen.getByRole('button', { name: 'Borrows' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('deletes a preset and persists the removal', () => {
    seedStorage([makePreset(), makePreset({ id: 'preset-2', name: 'Lends', filter: { type: 'lend' } })]);

    render(<FilterPresets />);
    fireEvent.click(screen.getByRole('button', { name: /delete preset Borrows/i }));

    expect(screen.queryByRole('button', { name: 'Borrows' })).not.toBeInTheDocument();
    expect(readStorage().presets).toEqual([expect.objectContaining({ name: 'Lends' })]);
  });

  it('leaves an open rename form untouched when another preset is deleted', () => {
    seedStorage([makePreset(), makePreset({ id: 'preset-2', name: 'Lends', filter: { type: 'lend' } })]);

    render(<FilterPresets />);
    fireEvent.click(screen.getByRole('button', { name: /rename preset Borrows/i }));
    fireEvent.click(screen.getByRole('button', { name: /delete preset Lends/i }));

    expect(screen.getByLabelText(/rename preset Borrows/i)).toHaveValue('Borrows');
    expect(readStorage().presets).toEqual([expect.objectContaining({ name: 'Borrows' })]);
  });

  it('shows the empty state again after the last preset is deleted', () => {
    seedStorage([makePreset()]);

    render(<FilterPresets />);
    fireEvent.click(screen.getByRole('button', { name: /delete preset Borrows/i }));

    expect(screen.getByText(/no saved presets yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: /saved filter presets/i })).not.toBeInTheDocument();
    expect(readStorage().presets).toEqual([]);
  });

  it('announces the applied preset in a live region', () => {
    seedStorage([makePreset()]);

    render(<FilterPresets />);
    fireEvent.click(screen.getByRole('button', { name: 'Borrows' }));

    expect(screen.getByText('Applied preset "Borrows".')).toBeInTheDocument();
  });

  it('recovers from a corrupt storage payload', () => {
    window.localStorage.setItem(PRESETS_STORAGE_KEY, '{not json');

    render(<FilterPresets />);

    expect(screen.getByText(/no saved presets yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('migrates a legacy (unversioned array) payload', () => {
    window.localStorage.setItem(
      PRESETS_STORAGE_KEY,
      JSON.stringify([{ id: 'legacy-1', name: 'Legacy', filter: { type: 'repay' } }])
    );

    render(<FilterPresets />);

    expect(screen.getByRole('button', { name: 'Legacy' })).toBeInTheDocument();
  });

  it('falls back to session-only presets when storage is disabled', async () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new DOMException('QuotaExceededError');
      }),
      removeItem: vi.fn(),
    };
    setUrl('type=borrow');

    render(<FilterPresets storage={storage} />);

    expect(screen.getByText(/browser storage is unavailable/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /save current filters/i }));
    fireEvent.change(screen.getByLabelText(/preset name/i), { target: { value: 'Session only' } });
    fireEvent.click(screen.getByRole('button', { name: /save preset/i }));

    // The preset is usable in-session even though it could not be written
    expect(screen.getByRole('button', { name: 'Session only' })).toBeInTheDocument();
    expect(
      screen.getByText('Saved preset "Session only" for this session only.')
    ).toBeInTheDocument();
    await waitFor(() => expect(storage.setItem).toHaveBeenCalled());
  });

  it('focuses the name field when a form opens', async () => {
    seedStorage([makePreset()]);

    render(<FilterPresets />);
    fireEvent.click(screen.getByRole('button', { name: /save current filters/i }));
    await waitFor(() => expect(screen.getByLabelText(/preset name/i)).toHaveFocus());

    fireEvent.click(screen.getByRole('button', { name: /rename preset Borrows/i }));
    await waitFor(() =>
      expect(screen.getByLabelText(/rename preset Borrows/i)).toHaveFocus()
    );
  });
});
