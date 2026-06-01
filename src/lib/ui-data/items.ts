import { BUNDLES, getBundle as _getBundle, type Bundle } from "./bundles";

// Re-export legacy bundle accessor so callers can migrate to the
// unified items module without touching bundles.ts directly.
export const getBundle = _getBundle;
export { BUNDLES };

export type ItemType = "bundle";

export type DiscoveryMethod = "Editorial" | "Community" | "Auto-discovered";

export type Tool =
  | "Claude"
  | "Cursor"
  | "Lovable"
  | "Figma Make"
  | "ChatGPT"
  | "Universal";

export type Attribution = {
  sourceUrl: string;
  author: string;
  license: string;
  discoveryMethod: DiscoveryMethod;
  communityHandle?: string;
  discoveredAt: string;
  verifiedAt: string;
};

type BaseItem = {
  id: string;
  type: ItemType;
  num: string;
  name: string;
  tagline: string;
  description: string;
  tags: string[];
  tools: Tool[];
  attribution: Attribution;
  relatedIds: string[];
  updatedAgo: string;
  accent: string;
  icon: string;
  category:
    | "AI & LLM Platforms"
    | "Developer Tools & IDEs"
    | "Database & DevOps"
    | "Productivity & SaaS"
    | "Design & Creative Tools"
    | "Fintech & Crypto"
    | "E-commerce & Retail"
    | "Media & Consumer Tech"
    | "Automotive";
};

export type BundleItem = BaseItem & {
  type: "bundle";
  bundle: Bundle;
};

export type Item = BundleItem;

// ─────────────────────────────────────────────────────────────
// Type metadata (accent, icon, label)
// ─────────────────────────────────────────────────────────────

import { VIOLET } from "./tokens";

export const TYPE_META: Record<
  ItemType,
  { label: string; plural: string; accent: string; icon: string }
> = {
  bundle: { label: "Design system", plural: "Design systems", accent: VIOLET, icon: "▢" },
};

// ─────────────────────────────────────────────────────────────
// Attribution sidecar for the existing 8 bundles
// (Bundle objects in bundles.ts predate this schema; we attach
//  attribution here so we don't churn that file.)
// ─────────────────────────────────────────────────────────────

type ItemCategory = BaseItem["category"];

const ITEM_CATEGORY: Record<string, ItemCategory> = {
  // Bundles (design systems)
  linear: "Developer Tools & IDEs",
  stripe: "Fintech & Crypto",
  notion: "Productivity & SaaS",
  carbon: "Database & DevOps",
  arc: "Media & Consumer Tech",
  vercel: "Developer Tools & IDEs",
  ramp: "Fintech & Crypto",
  atlassian: "Productivity & SaaS",
};

function categoryFor(id: string): ItemCategory {
  return ITEM_CATEGORY[id] ?? "Productivity & SaaS";
}

const BUNDLE_ATTR: Record<
  string,
  { tools: Tool[]; relatedIds: string[]; discoveryMethod: DiscoveryMethod }
> = {
  linear: {
    tools: ["Claude", "Cursor", "Lovable", "Figma Make"],
    relatedIds: [],
    discoveryMethod: "Editorial",
  },
  stripe: {
    tools: ["Claude", "Cursor", "Lovable"],
    relatedIds: [],
    discoveryMethod: "Editorial",
  },
  notion: {
    tools: ["Claude", "Cursor", "Lovable", "Figma Make"],
    relatedIds: [],
    discoveryMethod: "Editorial",
  },
  carbon: {
    tools: ["Claude", "Cursor"],
    relatedIds: [],
    discoveryMethod: "Editorial",
  },
  arc: {
    tools: ["Claude", "Cursor", "Lovable"],
    relatedIds: [],
    discoveryMethod: "Community",
  },
  vercel: {
    tools: ["Claude", "Cursor", "Lovable", "Figma Make"],
    relatedIds: [],
    discoveryMethod: "Editorial",
  },
  ramp: {
    tools: ["Claude", "Cursor"],
    relatedIds: [],
    discoveryMethod: "Auto-discovered",
  },
  atlassian: {
    tools: ["Claude", "Cursor", "Lovable"],
    relatedIds: [],
    discoveryMethod: "Editorial",
  },
};

const COMMUNITY_HANDLES: Record<string, string> = {
  arc: "@thebrowsercompany",
  ramp: "discovery-bot",
};

function bundleToItem(b: Bundle): BundleItem {
  const meta = BUNDLE_ATTR[b.id] ?? {
    tools: b.worksWith as Tool[],
    relatedIds: [],
    discoveryMethod: "Editorial" as DiscoveryMethod,
  };
  return {
    id: b.id,
    type: "bundle",
    num: b.num,
    name: b.name,
    tagline: b.tagline,
    description: b.description,
    tags: b.tags,
    tools: meta.tools,
    relatedIds: meta.relatedIds,
    updatedAgo: b.updatedAgo,
    accent: TYPE_META.bundle.accent,
    icon: TYPE_META.bundle.icon,
    category: categoryFor(b.id),
    attribution: {
      sourceUrl: `https://${b.url}`,
      author: b.maintainer,
      license: b.license,
      discoveryMethod: meta.discoveryMethod,
      communityHandle: COMMUNITY_HANDLES[b.id],
      discoveredAt: b.updatedAgo,
      verifiedAt: b.updatedAgo,
    },
    bundle: b,
  };
}

// ─────────────────────────────────────────────────────────────
// Unified catalogue
// ─────────────────────────────────────────────────────────────

export const BUNDLE_ITEMS: BundleItem[] = BUNDLES.map(bundleToItem);

export const ITEMS: Item[] = [...BUNDLE_ITEMS];

export function getItem(id: string): Item | undefined {
  return ITEMS.find((i) => i.id === id);
}
