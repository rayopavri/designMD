/**
 * Fix-up pass: rewrites stale imports inside migrated page/component files
 * to match the new Next.js project layout.
 *
 * For each .tsx file under src/app and src/components/ui:
 *   1. Replace any `from "../components/X"` (or "../../...") with
 *      `from "@/components/ui/X"`.
 *   2. Replace any `from "../lib/X"` with `from "@/lib/ui-data/X"`.
 *   3. Strip any remaining `from "wouter"` imports.
 *   4. Detect which symbols the file uses (Link, useRouter, usePathname,
 *      useSearchParams, useParams) and ensure proper imports exist at top.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join } from 'path';

const APP_DIR = '/Users/rpavri/Documents/Work/claude code/uiuxofai/designmd-app/src/app';
const UI_DIR = '/Users/rpavri/Documents/Work/claude code/uiuxofai/designmd-app/src/components/ui';

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (full.endsWith('.tsx') || full.endsWith('.ts')) files.push(full);
  }
  return files;
}

function fixFile(path: string): boolean {
  const original = readFileSync(path, 'utf8');
  let out = original;

  // 1. Fix relative imports to components → @/components/ui/X
  out = out.replace(
    /from\s+["'](?:\.\.\/)+components\/([^"']+)["']/g,
    'from "@/components/ui/$1"',
  );

  // 2. Fix relative imports to lib → @/lib/ui-data/X (except auth/auth.ts edge)
  out = out.replace(
    /from\s+["'](?:\.\.\/)+lib\/auth["']/g,
    'from "@/lib/ui-data/mockAuth"',
  );
  out = out.replace(
    /from\s+["'](?:\.\.\/)+lib\/([^"']+)["']/g,
    'from "@/lib/ui-data/$1"',
  );

  // 3. Strip all remaining wouter imports (whole lines)
  out = out.replace(/^\s*import[^;]*from\s+["']wouter["'];?\s*$/gm, '');

  // 4. Detect required Next.js navigation symbols
  const needs = {
    Link: /\bLink\b/.test(out) && !/from\s+["']next\/link["']/.test(out),
    useRouter: /\buseRouter\(/.test(out),
    usePathname: /\busePathname\(/.test(out),
    useSearchParams: /\buseSearchParams\(/.test(out),
    useParams: /\buseParams\(/.test(out),
  };

  // Build the navigation import line
  const navSymbols = (['useRouter', 'usePathname', 'useSearchParams', 'useParams'] as const).filter((s) => needs[s]);
  const hasNavImport = /from\s+["']next\/navigation["']/.test(out);

  // Insert missing imports near the top (after "use client" if present)
  const inserts: string[] = [];
  if (needs.Link && !out.includes('from "next/link"')) {
    inserts.push('import Link from "next/link";');
  }
  if (navSymbols.length > 0 && !hasNavImport) {
    inserts.push(`import { ${navSymbols.join(', ')} } from "next/navigation";`);
  } else if (navSymbols.length > 0 && hasNavImport) {
    // Merge with existing next/navigation import
    out = out.replace(
      /import\s*\{([^}]*)\}\s*from\s*["']next\/navigation["'];?/,
      (_match, existing) => {
        const existingList = existing.split(',').map((s: string) => s.trim()).filter(Boolean);
        const merged = Array.from(new Set([...existingList, ...navSymbols])).join(', ');
        return `import { ${merged} } from "next/navigation";`;
      },
    );
  }

  if (inserts.length > 0) {
    // Insert after the first line if it's "use client", else at top
    if (out.startsWith('"use client";')) {
      out = out.replace('"use client";\n', `"use client";\n\n${inserts.join('\n')}\n`);
    } else {
      out = `${inserts.join('\n')}\n${out}`;
    }
  }

  // 5. Replace `useRoute<{...}>("/foo/:id")` patterns (from wouter)
  //    with App Router useParams() — best-effort.
  out = out.replace(
    /const\s*\[\s*,\s*params\s*\]\s*=\s*useRoute<[^>]+>\(["'][^"']+["']\)\s*;/g,
    'const params = useParams<Record<string,string>>();',
  );
  out = out.replace(
    /const\s*\[\s*\w+\s*,\s*params\s*\]\s*=\s*useRoute<[^>]+>\(["'][^"']+["']\)\s*;/g,
    'const params = useParams<Record<string,string>>();',
  );
  // Ensure useParams import when used
  if (/\buseParams\(/.test(out) && !/useParams[,}]/.test(out)) {
    out = out.replace(
      /import\s*\{([^}]*)\}\s*from\s*["']next\/navigation["'];?/,
      (_m, list) => {
        const items = list.split(',').map((s: string) => s.trim()).filter(Boolean);
        if (!items.includes('useParams')) items.push('useParams');
        return `import { ${items.join(', ')} } from "next/navigation";`;
      },
    );
  }

  // Collapse 3+ blank lines down to 1
  out = out.replace(/\n{3,}/g, '\n\n');

  if (out !== original) {
    writeFileSync(path, out);
    return true;
  }
  return false;
}

let changed = 0;
let scanned = 0;
for (const file of [...walk(APP_DIR), ...walk(UI_DIR)]) {
  scanned++;
  if (fixFile(file)) changed++;
}
console.log(`Scanned ${scanned} files, fixed ${changed}`);
