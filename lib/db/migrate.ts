import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, client } from './index';

async function runMigrations() {
  console.log('Running database migrations with Drizzle...');
  try {
    await migrate(db, { migrationsFolder: 'drizzle' });
    console.log('✅ Migrations applied successfully');
  } catch (error) {
    console.error('❌ Failed to run database migrations:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
