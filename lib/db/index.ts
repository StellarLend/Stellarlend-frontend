import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import serverConfig from '../server-config';

// Wired to the database URL configured in server-config.ts
const connectionString = serverConfig.db.url;

// Disable logging in test/production to keep outputs clean, enable in dev
export const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client);
