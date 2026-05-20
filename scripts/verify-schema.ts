import { config } from 'dotenv';
config({ path: '.env.local' });
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { max: 1, ssl: 'require' });

async function main() {
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name`;
  const triggers = await sql`
    SELECT trigger_name, event_object_table
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
    ORDER BY event_object_table, trigger_name`;
  const enums = await sql`
    SELECT t.typname AS enum_name
    FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typtype = 'e' AND n.nspname = 'public'
    ORDER BY t.typname`;
  const functions = await sql`
    SELECT routine_name FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
    ORDER BY routine_name`;
  const categoryCount = await sql`SELECT count(*)::int AS n FROM categories`;
  const sourceStateCount = await sql`SELECT count(*)::int AS n FROM discovery_source_state`;

  console.log(`\n=== TABLES (${tables.length}) ===`);
  console.log(tables.map((t: any) => '  ' + t.table_name).join('\n'));
  console.log(`\n=== ENUMS (${enums.length}) ===`);
  console.log(enums.map((e: any) => '  ' + e.enum_name).join('\n'));
  console.log(`\n=== TRIGGERS (${triggers.length}) ===`);
  const seen = new Set<string>();
  for (const t of triggers as any[]) {
    const key = `${t.event_object_table}.${t.trigger_name}`;
    if (!seen.has(key)) {
      console.log(`  ${t.event_object_table}: ${t.trigger_name}`);
      seen.add(key);
    }
  }
  console.log(`\n=== FUNCTIONS (${functions.length}) ===`);
  console.log(functions.map((f: any) => '  ' + f.routine_name).join('\n'));
  console.log(`\n=== SEED DATA ===`);
  console.log(`  categories: ${categoryCount[0].n} rows`);
  console.log(`  discovery_source_state: ${sourceStateCount[0].n} rows`);
  console.log(`\n✓ Schema verification complete\n`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
