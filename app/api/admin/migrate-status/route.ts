export const runtime = 'nodejs';

import 'server-only';
import { NextResponse } from 'next/server';
import serverConfig from '../../../../lib/server-config';
import { listSourceMigrations, fetchAppliedMigrations, compareMigrationLists } from '../../../../lib/db/migration-state';
import pool from '../../../../lib/db/pool';

async function queryWithPg(): Promise<string[]> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL not configured');
  }

  const res = await fetchAppliedMigrations((sql: string) => pool.query(sql));
  return res;
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
