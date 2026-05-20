/**
 * One-shot UI migration script.
 *
 * Reads each .tsx file from the old Vite project, applies these transforms,
 * and writes the result to the Next.js project:
 *   1. Prepend "use client";  (every component or page becomes client-side)
 *   2. Rewrite Wouter imports:
 *        wouter Link            → next/link
 *        wouter useLocation     → next/navigation useRouter + usePathname
 *        wouter useSearch       → next/navigation useSearchParams
 *        wouter useRoute        → useParams from next/navigation (handled per-call)
 *        wouter Redirect        → custom helper redirects via router
 *   3. Rewrite ../lib/X paths   → @/lib/ui-data/X (mockAuth special-cased)
 *   4. Don't touch component-to-component imports (../components/X)
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const SRC_ROOT = '/Users/rpavri/Documents/Work/claude code/uiuxofai/designMD/artifacts/uiuxofai/src';
const DEST_ROOT = '/Users/rpavri/Documents/Work/claude code/uiuxofai/designmd-app/src';

function transform(content: string): string {
  let out = content;

  // ── 1. Lib paths ──
  // ../lib/auth → @/lib/ui-data/mockAuth (special name)
  out = out.replace(/from\s+["']\.\.\/lib\/auth["']/g, 'from "@/lib/ui-data/mockAuth"');
  // ../lib/X → @/lib/ui-data/X
  out = out.replace(/from\s+["']\.\.\/lib\/([^"']+)["']/g, 'from "@/lib/ui-data/$1"');

  // ── 2. Wouter Link → next/link ──
  // import { Link } from "wouter"
  out = out.replace(/import\s*\{\s*Link\s*\}\s*from\s*["']wouter["'];?/g, 'import Link from "next/link";');
  // import { Link, useLocation } from "wouter"
  out = out.replace(
    /import\s*\{\s*Link\s*,\s*useLocation\s*\}\s*from\s*["']wouter["'];?/g,
    'import Link from "next/link";\nimport { useRouter, usePathname } from "next/navigation";',
  );
  // import { useLocation } from "wouter"
  out = out.replace(
    /import\s*\{\s*useLocation\s*\}\s*from\s*["']wouter["'];?/g,
    'import { useRouter, usePathname } from "next/navigation";',
  );
  // import { useLocation, useSearch } from "wouter"
  out = out.replace(
    /import\s*\{\s*useLocation\s*,\s*useSearch\s*\}\s*from\s*["']wouter["'];?/g,
    'import { useRouter, usePathname, useSearchParams } from "next/navigation";',
  );
  // import { useSearch } from "wouter"
  out = out.replace(
    /import\s*\{\s*useSearch\s*\}\s*from\s*["']wouter["'];?/g,
    'import { useSearchParams } from "next/navigation";',
  );
  // import { Redirect, Route, ... } from "wouter" — strip; we don't use these
  out = out.replace(/import\s*\{[^}]*\}\s*from\s*["']wouter["'];?\n?/g, '');

  // ── 3. useLocation usage → useRouter + usePathname ──
  // const [location, setLocation] = useLocation();
  out = out.replace(
    /const\s*\[\s*(\w+)\s*,\s*(\w+)\s*\]\s*=\s*useLocation\(\)\s*;/g,
    'const _router = useRouter();\n  const $1 = usePathname();\n  const $2 = (path: string) => _router.push(path);',
  );
  // const [, setLocation] = useLocation();
  out = out.replace(
    /const\s*\[\s*,\s*(\w+)\s*\]\s*=\s*useLocation\(\)\s*;/g,
    'const _router = useRouter();\n  const $1 = (path: string) => _router.push(path);',
  );
  // const [location] = useLocation();
  out = out.replace(
    /const\s*\[\s*(\w+)\s*\]\s*=\s*useLocation\(\)\s*;/g,
    'const $1 = usePathname();',
  );

  // ── 4. useSearch() → useSearchParams().toString() ──
  out = out.replace(/useSearch\(\)/g, 'useSearchParams().toString()');

  // ── 5. Prepend "use client" if file uses React hooks ──
  if (/use(State|Effect|Ref|Memo|Callback|Id|Reducer|Context|Router|Pathname|SearchParams)/.test(out)) {
    if (!out.startsWith('"use client"') && !out.startsWith("'use client'")) {
      out = '"use client";\n\n' + out;
    }
  }

  return out;
}

function processFile(srcPath: string, destPath: string) {
  const content = readFileSync(srcPath, 'utf8');
  const transformed = transform(content);
  const dir = destPath.substring(0, destPath.lastIndexOf('/'));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(destPath, transformed);
  console.log(`  ✓ ${srcPath.replace(SRC_ROOT + '/', '')} → ${destPath.replace(DEST_ROOT + '/', '')}`);
}

console.log('→ Migrating components...');
for (const file of readdirSync(join(SRC_ROOT, 'components'))) {
  if (file.endsWith('.tsx')) {
    processFile(
      join(SRC_ROOT, 'components', file),
      join(DEST_ROOT, 'components/ui', file),
    );
  }
}

console.log('\n→ Migrating pages...');
// Each page goes to a specific App Router location
// Each page goes to a specific App Router location.
// Each value is [destination, componentName-to-default-export].
const pageMap: Record<string, [string, string]> = {
  'Home.tsx':         ['app/(public)/page.tsx',              'Home'],
  'Library.tsx':      ['app/(public)/library/page.tsx',      'Library'],
  // LibraryType.tsx — handled separately (needs param wrapper)
  'BundleDetail.tsx': ['app/(public)/library/[slug]/page.tsx','BundleDetail'],
  'Generate.tsx':     ['app/generate/page.tsx',              'Generate'],
  'CopySuccess.tsx':  ['app/copy/[id]/page.tsx',             'CopySuccess'],
  'CliDocs.tsx':      ['app/(public)/docs/cli/page.tsx',     'CliDocs'],
  'Login.tsx':        ['app/(auth)/login/page.tsx',          'Login'],
  'Welcome.tsx':      ['app/(auth)/welcome/page.tsx',        'Welcome'],
  'Account.tsx':      ['app/account/page.tsx',               'Account'],
  'not-found.tsx':    ['app/not-found.tsx',                  'NotFound'],
};

for (const [src, [dest, componentName]] of Object.entries(pageMap)) {
  const srcPath = join(SRC_ROOT, 'pages', src);
  if (!existsSync(srcPath)) continue;
  const content = readFileSync(srcPath, 'utf8');
  let transformed = transform(content);
  // Ensure a default export exists for App Router page.tsx files.
  if (!/export\s+default/.test(transformed)) {
    transformed += `\nexport default ${componentName};\n`;
  }
  const destPath = join(DEST_ROOT, dest);
  const dir = destPath.substring(0, destPath.lastIndexOf('/'));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(destPath, transformed);
  console.log(`  ✓ pages/${src} → ${dest}`);
}

console.log('\n✓ UI migration done');
