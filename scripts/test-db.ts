import { config } from 'dotenv';
config({ path: '.env.local' });
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const sql = postgres(url, { max: 1, ssl: 'require' });

async function main() {
  const result = await sql`SELECT NOW() as time, version() as version`;
  console.log('CONNECTED ✓');
  console.log('Time:', result[0].time);
  console.log('Version:', String(result[0].version).split(' ').slice(0, 2).join(' '));
  await sql.end();
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
