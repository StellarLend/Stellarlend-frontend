export const runtime = 'nodejs';

import 'server-only';
import { NextResponse } from 'next/server';
import serverConfig from '../../../../lib/server-config';
import { listSourceMigrations, fetchAppliedMigrations, compareMigrationLists } from '../../../../lib/db/migration-state';

async function queryWithPg(): Promise<string[]> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not configured');
  }

  // dynamic import so missing pg doesn't break environments that don't use DB
  const { Client } = await import('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const res = await fetchAppliedMigrations((sql: string) => client.query(sql));
    return res;
  } finally {
    await client.end();
  }
}

export async function GET(request: Request) {
  const token = request.headers.get('x-server-token')?.trim() ?? '';
  if (!token || token !== serverConfig.server.token) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 403 });
  }

  try {
    const source = await listSourceMigrations();
    const applied = await queryWithPg();

    const state = compareMigrationLists(source, applied);

    return NextResponse.json({ applied: state.applied, pending: state.pending, ok: state.ok });
  } catch (err: any) {
    return NextResponse.json({ error: { message: err?.message || 'Internal error' } }, { status: 500 });
  }
}
