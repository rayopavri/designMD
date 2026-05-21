/**
 * designmd database schema — Drizzle definitions.
 *
 * Translated from designmd-final-implementation-plan.md Section 4
 * (the canonical schema). Uses Firebase Auth, not GitHub OAuth.
 *
 * Notes:
 *  - CHECK constraints that call custom Postgres functions (e.g.
 *    is_valid_design_style) are declared inline via `sql\`...\``.
 *    Those functions are created in 0000_init.sql before Drizzle
 *    migrations run.
 *  - Triggers, validation functions, and seed data also live in
 *    0000_init.sql.
 *  - Enums are declared once via pgEnum and reused across tables.
 */
import {
  pgEnum,
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  jsonb,
  index,
  uniqueIndex,
  check,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql, relations } from 'drizzle-orm';

// ============================================================
// ENUMS
// ============================================================

export const bundleType = pgEnum('bundle_type', [
  'design_md',
  'skill',
  'agent',
]);

export const bundleStatus = pgEnum('bundle_status', [
  'personal',
  'pending_review',
  'published',
  'flagged',
  'rejected',
  'archived',
]);

export const collectionStatus = pgEnum('collection_status', [
  'draft',
  'published',
  'archived',
]);

export const generationStatus = pgEnum('generation_status', [
  'queued',
  'running',
  'completed',
  'failed',
]);

export const requestStatus = pgEnum('request_status', [
  'open',
  'in_progress',
  'completed',
  'rejected',
]);

export const candidateStatus = pgEnum('candidate_status', [
  'unclassified',
  'classified',
  'auto_drafted',
  'queued_for_review',
  'approved',
  'rejected',
  'duplicate',
]);

export const verificationMethod = pgEnum('verification_method', [
  'auto_track_record',
  'application_approved',
  'editor_grant',
]);

// ============================================================
// USERS
// ============================================================

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Auth (Firebase)
    firebaseUid: text('firebase_uid').notNull().unique(),
    authProvider: text('auth_provider').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').notNull().default(false),

    // Profile
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    handle: text('handle').unique(),

    // Designer profile (Verified Creator)
    bio: text('bio'),
    portfolioUrl: text('portfolio_url'),
    figmaProfileUrl: text('figma_profile_url'),
    dribbbleUrl: text('dribbble_url'),
    behanceUrl: text('behance_url'),
    linkedinUrl: text('linkedin_url'),

    // Preferences
    preferredTools: text('preferred_tools').array().notNull().default(sql`'{}'::text[]`),
    preferredStyle: text('preferred_style').array().notNull().default(sql`'{}'::text[]`),

    // Notifications
    emailOnSubmissionDecision: boolean('email_on_submission_decision').notNull().default(true),
    emailOnListingClaim: boolean('email_on_listing_claim').notNull().default(true),
    emailOnWeeklyDigest: boolean('email_on_weekly_digest').notNull().default(false),

    // Roles
    isEditor: boolean('is_editor').notNull().default(false),
    isVerifiedCreator: boolean('is_verified_creator').notNull().default(false),
    verificationMethod: verificationMethod('verification_method'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),

    // Lifecycle
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    check('chk_auth_provider', sql`${table.authProvider} IN ('google','email')`),
    check('chk_preferred_tools', sql`all_valid_tools(${table.preferredTools})`),
    check('chk_preferred_style', sql`all_valid_design_styles(${table.preferredStyle})`),
    index('idx_users_email').on(table.email),
    index('idx_users_firebase_uid').on(table.firebaseUid),
  ],
);

// ============================================================
// CATEGORIES
// ============================================================

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    parentId: uuid('parent_id').references((): any => categories.id, { onDelete: 'set null' }),
    level: integer('level').notNull(),
    color: text('color'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('chk_level', sql`${table.level} IN (1, 2)`),
    check('chk_level2_has_parent', sql`${table.level} = 1 OR ${table.parentId} IS NOT NULL`),
  ],
);

// ============================================================
// BUNDLES
// ============================================================

export const bundles = pgTable(
  'bundles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    type: bundleType('type').notNull().default('design_md'),

    // Content
    designMd: text('design_md'),
    companionPrompt: text('companion_prompt').notNull(),
    companionPromptVersion: integer('companion_prompt_version').notNull().default(1),
    companionPromptUpdatedAt: timestamp('companion_prompt_updated_at', { withTimezone: true }),
    companionPromptUpdatedBy: uuid('companion_prompt_updated_by').references(() => users.id),
    // 'pending' | 'ready' | 'failed' — companion is generated in a second
    // worker function so the main pipeline fits Vercel Hobby's 60s budget.
    companionStatus: text('companion_status').notNull().default('ready'),

    // Coverage scores (NULL = not scored, 0 = linter failed)
    coverageScore: integer('coverage_score'),
    coverageColors: integer('coverage_colors'),
    coverageTypography: integer('coverage_typography'),
    coverageLayout: integer('coverage_layout'),
    coverageElevation: integer('coverage_elevation'),
    coverageShapes: integer('coverage_shapes'),
    coverageComponents: integer('coverage_components'),
    coverageDosDonts: integer('coverage_dos_donts'),

    // Classification
    primaryCategoryId: uuid('primary_category_id').references(() => categories.id),
    secondaryCategoryId: uuid('secondary_category_id').references(() => categories.id),
    designStyle: text('design_style').array().notNull().default(sql`'{}'::text[]`),
    compatibleTools: text('compatible_tools').array().notNull().default(sql`'{}'::text[]`),

    // Status & lifecycle
    status: bundleStatus('status').notNull().default('personal'),
    isCurated: boolean('is_curated').notNull().default(false),
    isFeatured: boolean('is_featured').notNull().default(false),

    // Ownership — nullable to support anonymous generation. Signed-in
    // users still get attribution; anonymous bundles have created_by=null.
    createdBy: uuid('created_by').references(() => users.id),

    // Attribution
    sourceUrl: text('source_url'),
    sourceUrlNormalized: text('source_url_normalized'),
    sourceDomain: text('source_domain'),
    authorName: text('author_name'),
    authorEmail: text('author_email'),
    authorUrl: text('author_url'),
    license: text('license'),
    attributionStatement: text('attribution_statement'),

    // Claim & takedown
    takedownToken: text('takedown_token').unique(),
    takedownClaimed: boolean('takedown_claimed').notNull().default(false),
    claimedBy: uuid('claimed_by').references(() => users.id),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),

    // Visual card data
    paletteColors: text('palette_colors').array().notNull().default(sql`'{}'::text[]`),
    brandLogoUrl: text('brand_logo_url'),
    brandInitial: text('brand_initial'),
    brandColor: text('brand_color'),

    // Quality signals (maintained by trigger)
    voteCount: integer('vote_count').notNull().default(0),
    positiveVoteCount: integer('positive_vote_count').notNull().default(0),
    positiveVoteRate: numeric('positive_vote_rate', { precision: 5, scale: 2 })
      .notNull()
      .default('0.00'),
    copyCount: integer('copy_count').notNull().default(0),
    downloadCount: integer('download_count').notNull().default(0),
    cliInstallCount: integer('cli_install_count').notNull().default(0),

    // Content fingerprint
    contentFingerprint: text('content_fingerprint'),

    // Freshness
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    isStale: boolean('is_stale').notNull().default(false),

    // Editorial
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    reviewedBy: uuid('reviewed_by').references(() => users.id),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewNotes: text('review_notes'),

    // Accessibility advisory — surfaced to consumers, not a quality penalty.
    // Populated when the source brand has WCAG-failing contrast pairs.
    accessibilityNotes: text('accessibility_notes'),

    // Metadata
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
  },
  (table) => [
    check('chk_coverage_score', sql`${table.coverageScore} IS NULL OR (${table.coverageScore} BETWEEN 0 AND 100)`),
    check('chk_coverage_colors', sql`${table.coverageColors} IS NULL OR (${table.coverageColors} BETWEEN 0 AND 100)`),
    check('chk_coverage_typography', sql`${table.coverageTypography} IS NULL OR (${table.coverageTypography} BETWEEN 0 AND 100)`),
    check('chk_coverage_layout', sql`${table.coverageLayout} IS NULL OR (${table.coverageLayout} BETWEEN 0 AND 100)`),
    check('chk_coverage_elevation', sql`${table.coverageElevation} IS NULL OR (${table.coverageElevation} BETWEEN 0 AND 100)`),
    check('chk_coverage_shapes', sql`${table.coverageShapes} IS NULL OR (${table.coverageShapes} BETWEEN 0 AND 100)`),
    check('chk_coverage_components', sql`${table.coverageComponents} IS NULL OR (${table.coverageComponents} BETWEEN 0 AND 100)`),
    check('chk_coverage_dos_donts', sql`${table.coverageDosDonts} IS NULL OR (${table.coverageDosDonts} BETWEEN 0 AND 100)`),
    check('chk_design_style', sql`all_valid_design_styles(${table.designStyle})`),
    check('chk_compatible_tools', sql`all_valid_tools(${table.compatibleTools})`),
    check(
      'chk_source_url',
      sql`${table.sourceUrl} IS NULL OR ${table.sourceUrl} ~* '^https?://[^\\s<>"{}|\\\\^\`\\[\\]]+$'`,
    ),
    check('chk_palette_colors', sql`all_valid_hex_colors(${table.paletteColors})`),
    index('idx_bundles_status').on(table.status),
    index('idx_bundles_created_by').on(table.createdBy),
    index('idx_bundles_status_creator').on(table.status, table.createdBy),
    index('idx_bundles_source_normalized').on(table.sourceUrlNormalized),
    index('idx_bundles_fingerprint').on(table.contentFingerprint),
  ],
);

// ============================================================
// BUNDLE VOTES
// ============================================================

export const bundleVotes = pgTable(
  'bundle_votes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bundleId: uuid('bundle_id')
      .notNull()
      .references(() => bundles.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    worked: boolean('worked').notNull(),
    reasonTags: text('reason_tags').array().notNull().default(sql`'{}'::text[]`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('uq_votes_bundle_user').on(table.bundleId, table.userId),
    check('chk_reason_tags', sql`all_valid_vote_reasons(${table.reasonTags})`),
    check(
      'chk_reason_requires_failure',
      sql`${table.worked} = TRUE OR array_length(${table.reasonTags}, 1) > 0`,
    ),
    index('idx_votes_bundle').on(table.bundleId),
    index('idx_votes_user').on(table.userId),
  ],
);

// ============================================================
// COLLECTIONS
// ============================================================

export const collections = pgTable(
  'collections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    primaryCategoryId: uuid('primary_category_id').references(() => categories.id),
    designStyle: text('design_style').array().notNull().default(sql`'{}'::text[]`),
    compatibleTools: text('compatible_tools').array().notNull().default(sql`'{}'::text[]`),
    status: collectionStatus('status').notNull().default('draft'),
    isCurated: boolean('is_curated').notNull().default(false),
    copyCount: integer('copy_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('chk_col_design_style', sql`all_valid_design_styles(${table.designStyle})`),
  ],
);

export const collectionItems = pgTable(
  'collection_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    collectionId: uuid('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    bundleId: uuid('bundle_id')
      .notNull()
      .references(() => bundles.id, { onDelete: 'restrict' }),
    role: text('role').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    uniqueIndex('uq_collection_bundle').on(table.collectionId, table.bundleId),
    check('chk_role', sql`${table.role} IN ('design_md','skill','agent')`),
  ],
);

// ============================================================
// BUNDLE REQUESTS
// ============================================================

export const bundleRequests = pgTable('bundle_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  url: text('url').notNull(),
  normalizedUrl: text('normalized_url').notNull().unique(),
  title: text('title'),
  description: text('description'),
  requestedBy: uuid('requested_by').references(() => users.id),
  upvoteCount: integer('upvote_count').notNull().default(1),
  votedUserIds: uuid('voted_user_ids').array().notNull().default(sql`'{}'::uuid[]`),
  status: requestStatus('status').notNull().default('open'),
  completedBundleId: uuid('completed_bundle_id').references(() => bundles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================
// GENERATION JOBS
// ============================================================

export const generationJobs = pgTable(
  'generation_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // url-source jobs: the submitted URL. upload-source jobs: an
    // upload://<hash> identifier so the source key is never null.
    url: text('url').notNull(),
    // Null for upload jobs (no URL to normalize).
    normalizedUrl: text('normalized_url'),
    status: generationStatus('status').notNull().default('queued'),
    currentStep: text('current_step'),

    // Source mode — 'url' (default, backwards compatible) or 'upload'.
    sourceType: text('source_type').notNull().default('url'),
    // For upload jobs: base64 image bytes, mime type, sha-256, brand name.
    imageData: text('image_data'),
    imageMimeType: text('image_mime_type'),
    imageHash: text('image_hash'),
    brandName: text('brand_name'),

    // Ownership — nullable to support anonymous generation.
    userId: uuid('user_id').references(() => users.id),

    // Duplicate detection
    existingBundleId: uuid('existing_bundle_id').references(() => bundles.id),
    isUpdateRequested: boolean('is_update_requested').notNull().default(false),

    // Admin re-run target: when set, the worker UPDATEs this bundle in
    // place instead of INSERTing a new row. Editor-managed fields
    // (title, description, license, etc.) are preserved.
    targetBundleId: uuid('target_bundle_id').references(() => bundles.id),

    // Result
    resultBundleId: uuid('result_bundle_id').references(() => bundles.id),

    // Error tracking
    errorMessage: text('error_message'),
    errorStep: text('error_step'),

    // Compliance
    compliancePassed: boolean('compliance_passed'),
    complianceBlockedReason: text('compliance_blocked_reason'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_jobs_user').on(table.userId, table.createdAt),
    index('idx_jobs_normalized_url').on(table.normalizedUrl),
    index('idx_jobs_image_hash').on(table.imageHash, table.userId),
  ],
);

// ============================================================
// DISCOVERY (Phase 2)
// ============================================================

export const discoveryCandidates = pgTable(
  'discovery_candidates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: text('source').notNull(),
    sourceId: text('source_id').notNull(),
    sourceUrl: text('source_url').notNull(),
    rawContent: text('raw_content'),
    contentFingerprint: text('content_fingerprint'),

    // Attribution
    authorName: text('author_name'),
    authorHandle: text('author_handle'),
    authorUrl: text('author_url'),
    authorEmail: text('author_email'),
    license: text('license'),
    discoveredAt: timestamp('discovered_at', { withTimezone: true }).notNull().defaultNow(),

    // Classifier output
    classifiedAt: timestamp('classified_at', { withTimezone: true }),
    isSafe: boolean('is_safe'),
    isRelevant: boolean('is_relevant'),
    isAiGenerated: boolean('is_ai_generated'),
    contentQuality: integer('content_quality'),
    specificityScore: integer('specificity_score'),
    compositeScore: integer('composite_score'),
    suggestedCategory: text('suggested_category'),
    suggestedStyle: text('suggested_style').array(),
    classifierNotes: text('classifier_notes'),

    // Auto-draft
    autoDraftedAt: timestamp('auto_drafted_at', { withTimezone: true }),
    draftDesignMd: text('draft_design_md'),
    draftCompanionPrompt: text('draft_companion_prompt'),

    // Routing
    status: candidateStatus('status').notNull().default('unclassified'),
    rejectedReason: text('rejected_reason'),
    reviewedBy: uuid('reviewed_by').references(() => users.id),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    promotedToBundleId: uuid('promoted_to_bundle_id').references(() => bundles.id),
  },
  (table) => [
    uniqueIndex('uq_candidates_source').on(table.source, table.sourceId),
    check('chk_source', sql`${table.source} IN ('github','reddit','hackernews')`),
    index('idx_candidates_status').on(table.status),
    index('idx_candidates_fingerprint').on(table.contentFingerprint),
  ],
);

export const discoverySourceState = pgTable('discovery_source_state', {
  source: text('source').primaryKey(),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }).notNull().defaultNow(),
  lastCursor: text('last_cursor'),
  lastRunStatus: text('last_run_status').notNull().default('pending'),
  itemsFound: integer('items_found').notNull().default(0),
  itemsClassified: integer('items_classified').notNull().default(0),
  errors: text('errors'),
});

// ============================================================
// GUARDRAILS
// ============================================================

export const domainBlocklist = pgTable(
  'domain_blocklist',
  {
    domain: text('domain').primaryKey(),
    category: text('category').notNull(),
    reason: text('reason'),
    addedBy: uuid('added_by').references(() => users.id),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
    source: text('source'),
  },
  (table) => [
    check(
      'chk_blocklist_category',
      sql`${table.category} IN ('nsfw','malware','spam','scrape_ban','manual')`,
    ),
    index('idx_blocklist_category').on(table.category),
  ],
);

export const abuseSignals = pgTable(
  'abuse_signals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id),
    ipHash: text('ip_hash'),
    signalType: text('signal_type').notNull(),
    details: jsonb('details'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_abuse_user_date').on(table.userId, table.createdAt)],
);

export const bannedUsers = pgTable('banned_users', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id),
  reason: text('reason').notNull(),
  bannedAt: timestamp('banned_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  bannedBy: uuid('banned_by').references(() => users.id),
});

export const guardrailRejections = pgTable(
  'guardrail_rejections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workflow: text('workflow').notNull(),
    layer: text('layer').notNull(),
    url: text('url'),
    candidateId: uuid('candidate_id').references(() => discoveryCandidates.id),
    userId: uuid('user_id').references(() => users.id),
    reason: text('reason').notNull(),
    details: jsonb('details'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check('chk_workflow', sql`${table.workflow} IN ('generator','discovery')`)],
);

// ============================================================
// VERIFIED CREATOR APPLICATIONS
// ============================================================

export const verificationApplications = pgTable(
  'verification_applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id)
      .unique(),
    portfolioUrl: text('portfolio_url').notNull(),
    bio: text('bio').notNull(),
    profileLinks: jsonb('profile_links').notNull().default(sql`'{}'::jsonb`),
    status: text('status').notNull().default('pending'),
    reviewNotes: text('review_notes'),
    reviewedBy: uuid('reviewed_by').references(() => users.id),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check('chk_app_status', sql`${table.status} IN ('pending','approved','rejected')`)],
);

// ============================================================
// RELATIONS (for type-safe queries with .with())
// ============================================================

export const usersRelations = relations(users, ({ many }) => ({
  bundles: many(bundles),
  votes: many(bundleVotes),
  jobs: many(generationJobs),
}));

export const bundlesRelations = relations(bundles, ({ one, many }) => ({
  creator: one(users, { fields: [bundles.createdBy], references: [users.id] }),
  reviewer: one(users, { fields: [bundles.reviewedBy], references: [users.id] }),
  primaryCategory: one(categories, {
    fields: [bundles.primaryCategoryId],
    references: [categories.id],
    relationName: 'primary_category',
  }),
  secondaryCategory: one(categories, {
    fields: [bundles.secondaryCategoryId],
    references: [categories.id],
    relationName: 'secondary_category',
  }),
  votes: many(bundleVotes),
}));

export const bundleVotesRelations = relations(bundleVotes, ({ one }) => ({
  bundle: one(bundles, { fields: [bundleVotes.bundleId], references: [bundles.id] }),
  user: one(users, { fields: [bundleVotes.userId], references: [users.id] }),
}));

export const collectionsRelations = relations(collections, ({ many }) => ({
  items: many(collectionItems),
}));

export const collectionItemsRelations = relations(collectionItems, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionItems.collectionId],
    references: [collections.id],
  }),
  bundle: one(bundles, { fields: [collectionItems.bundleId], references: [bundles.id] }),
}));

// Helpful type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Bundle = typeof bundles.$inferSelect;
export type NewBundle = typeof bundles.$inferInsert;
export type BundleVote = typeof bundleVotes.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type GenerationJob = typeof generationJobs.$inferSelect;
