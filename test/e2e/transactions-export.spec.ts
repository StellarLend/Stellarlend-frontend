import { test, expect } from '@playwright/test';

const EXPORT_API = '/api/transactions/export';
const TRANSACTIONS_PAGE = '/dashboard/transactions';

// Minimal stubs for deterministic CSV content
const STUB_COMPLETED = [
  { id: 'TXN001', type: 'Lend',   amount: 100, asset: 'XLM',  date: '2025-01-10', time: '10:00', status: 'Completed' },
  { id: 'TXN002', type: 'Borrow', amount: 200, asset: 'BTC',  date: '2025-01-11', time: '11:00', status: 'Completed' },
];
const STUB_MIXED = [
  ...STUB_COMPLETED,
  { id: 'TXN003', type: 'Repay',    amount: 50,  asset: 'XLM',  date: '2025-01-12', time: '12:00', status: 'Processing' },
  { id: 'TXN004', type: 'Withdraw', amount: 75,  asset: 'STRK', date: '2025-01-13', time: '13:00', status: 'Failed' },
];

const CSV_HEADER = '"ID","Type","Amount","Asset","Date","Time","Status"';

/** Parse a quoted CSV row into fields */
function parseCsvRow(line: string): string[] {
  return line.split(',').map((f) => f.replace(/^"|"$/g, ''));
}

test.describe('Transactions CSV Export', () => {
  // ── helpers ──────────────────────────────────────────────────────────────

  /** Stub the export endpoint to return a known CSV body */
  async function stubExport(page: Parameters<typeof test>[1] extends { page: infer P } ? P : never, rows: typeof STUB_MIXED) {
    const csv = [
      CSV_HEADER,
      ...rows.map((r) =>
        [`"${r.id}"`, `"${r.type}"`, `"${r.amount}"`, `"${r.asset}"`, `"${r.date}"`, `"${r.time}"`, `"${r.status}"`].join(',')
      ),
    ].join('\r\n');

    await page.route(`**${EXPORT_API}**`, (route) =>
      route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="transactions-2025-01-10.csv"`,
        },
        body: csv,
      })
    );
  }

  /** Stub the export endpoint to return an empty CSV (header only) */
  async function stubEmptyExport(page: Parameters<typeof test>[1] extends { page: infer P } ? P : never) {
    await page.route(`**${EXPORT_API}**`, (route) =>
      route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="transactions-2025-01-10.csv"`,
        },
        body: CSV_HEADER,
      })
    );
  }

  /** Stub the export endpoint to return a server error */
  async function stubExportError(page: Parameters<typeof test>[1] extends { page: infer P } ? P : never) {
    await page.route(`**${EXPORT_API}**`, (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'Internal Server Error' }) })
    );
  }

  // ── tests ─────────────────────────────────────────────────────────────────

  test('Export CSV button is visible on the transactions page', async ({ page }) => {
    await page.route(`**${EXPORT_API}**`, (route) => route.fulfill({ status: 200, body: CSV_HEADER }));
    await page.goto(TRANSACTIONS_PAGE);
    await expect(page.getByRole('button', { name: /export csv/i })).toBeVisible();
  });

  test('clicking Export CSV triggers a download', async ({ page }) => {
    await stubExport(page, STUB_MIXED);
    await page.goto(TRANSACTIONS_PAGE);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /export csv/i }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/transactions.*\.csv$/i);
  });

  test('downloaded CSV has the correct header row', async ({ page }) => {
    await stubExport(page, STUB_MIXED);
    await page.goto(TRANSACTIONS_PAGE);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /export csv/i }).click(),
    ]);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const content = Buffer.concat(chunks).toString('utf-8');

    const firstLine = content.split(/\r?\n/)[0];
    const cols = parseCsvRow(firstLine);
    expect(cols).toEqual(['ID', 'Type', 'Amount', 'Asset', 'Date', 'Time', 'Status']);
  });

  test('downloaded CSV rows respect an active status filter (Completed only)', async ({ page }) => {
    // The page sends the active filter as a query param; stub only Completed rows
    await page.route(`**${EXPORT_API}**`, async (route) => {
      const url = new URL(route.request().url());
      const status = url.searchParams.get('status') ?? 'All';
      const rows = status === 'Completed' ? STUB_COMPLETED : STUB_MIXED;
      const csv = [
        CSV_HEADER,
        ...rows.map((r) =>
          [`"${r.id}"`, `"${r.type}"`, `"${r.amount}"`, `"${r.asset}"`, `"${r.date}"`, `"${r.time}"`, `"${r.status}"`].join(',')
        ),
      ].join('\r\n');
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="transactions.csv"' },
        body: csv,
      });
    });

    await page.goto(`${TRANSACTIONS_PAGE}?status=Completed`);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /export csv/i }).click(),
    ]);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const lines = Buffer.concat(chunks).toString('utf-8').split(/\r?\n/).filter(Boolean);

    // header + two Completed rows
    expect(lines).toHaveLength(3);
    const dataRows = lines.slice(1).map(parseCsvRow);
    for (const row of dataRows) {
      expect(row[6]).toBe('Completed');
    }
  });

  test('empty-filtered export yields header row only', async ({ page }) => {
    await stubEmptyExport(page);
    await page.goto(TRANSACTIONS_PAGE);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /export csv/i }).click(),
    ]);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const lines = Buffer.concat(chunks).toString('utf-8').split(/\r?\n/).filter(Boolean);

    expect(lines).toHaveLength(1);
    expect(parseCsvRow(lines[0])).toEqual(['ID', 'Type', 'Amount', 'Asset', 'Date', 'Time', 'Status']);
  });

  test('large export (100 rows) downloads without truncation', async ({ page }) => {
    const largeRows = Array.from({ length: 100 }, (_, i) => ({
      id: `TXN${String(i + 1).padStart(3, '0')}`,
      type: 'Lend',
      amount: i + 1,
      asset: 'XLM',
      date: '2025-01-01',
      time: '00:00',
      status: 'Completed',
    }));
    await stubExport(page, largeRows);
    await page.goto(TRANSACTIONS_PAGE);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /export csv/i }).click(),
    ]);

    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const lines = Buffer.concat(chunks).toString('utf-8').split(/\r?\n/).filter(Boolean);

    // header + 100 data rows
    expect(lines).toHaveLength(101);
  });

  test('export failure surfaces an error / does not crash the page', async ({ page }) => {
    await stubExportError(page);
    await page.goto(TRANSACTIONS_PAGE);

    // Listen for unexpected uncaught errors
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // Click the button; the route returns 500
    await page.getByRole('button', { name: /export csv/i }).click();

    // Page should remain intact (no hard crash)
    await expect(page.getByRole('button', { name: /export csv/i })).toBeVisible();

    // No uncaught JS exceptions from a fetch error
    expect(errors.filter((e) => /export/i.test(e))).toHaveLength(0);
  });
});
