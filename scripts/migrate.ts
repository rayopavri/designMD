/**
 * Migration runner.
 *
 * Order of operations:
 *   1. Run 0000_init.sql  — extensions + validation functions
 *      (CHECK constraints in the Drizzle schema reference these)
 *   2. Run Drizzle migrations — creates all tables, enums, indexes
 *   3. Run 9999_triggers_and_seed.sql — triggers + category seed
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { readFileSync } from 'fs';
import { join } from 'path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('✗ DATABASE_URL not set');
  process.exit(1);
}

const MIGRATIONS_DIR = join(process.cwd(), 'src/lib/db/migrations');

async function main() {
  const client = postgres(DATABASE_URL!, { max: 1, ssl: 'require' });

  try {
    // ── 1. Run 0000_init.sql ──
    console.log('→ Running 0000_init.sql (extensions + validation fns)...');
    const initSql = readFileSync(join(MIGRATIONS_DIR, '0000_init.sql'), 'utf8');
    await client.unsafe(initSql);
    console.log('  ✓ init done');

    // ── 2. Run Drizzle migrations ──
    console.log('→ Running Drizzle migrations (tables, enums, indexes)...');
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: MIGRATIONS_DIR });
    console.log('  ✓ Drizzle migrations done');

    // ── 3. Run 9999_triggers_and_seed.sql ──
    console.log('→ Running 9999_triggers_and_seed.sql (triggers + seed)...');
    const triggersSql = readFileSync(
      join(MIGRATIONS_DIR, '9999_triggers_and_seed.sql'),
      'utf8',
    );
    await client.unsafe(triggersSql);
    console.log('  ✓ triggers + seed done');

    console.log('\n✓ All migrations applied successfully');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('\n✗ Migration failed:', e.message);
  console.error(e);
  process.exit(1);
});
