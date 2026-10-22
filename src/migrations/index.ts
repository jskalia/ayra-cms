import * as migration_20261019_140655_baseline from './20261019_140655_baseline';
import * as migration_20261019_201653_payload_3_91_upgrade from './20261019_201653_payload_3_91_upgrade';
import * as migration_20261019_203808_blob_storage_fields from './20261019_203808_blob_storage_fields';
import * as migration_20261019_204600_tenants_roles_api_keys from './20261019_204600_tenants_roles_api_keys';
import * as migration_20261019_205922_document_locks_off from './20261019_205922_document_locks_off';
import * as migration_20261019_213214_content_model_foundation from './20261019_213214_content_model_foundation';
import * as migration_20261019_213728_pages from './20261019_213728_pages';
import * as migration_20261019_215845_retire_authors_categories_post_drafts from './20261019_215845_retire_authors_categories_post_drafts';
import * as migration_20261019_215903_posts_and_whats_new from './20261019_215903_posts_and_whats_new';
import * as migration_20261019_220955_sync_receipts_markdown_bodies from './20261019_220955_sync_receipts_markdown_bodies';
import * as migration_20261020_212900_legal_decks_trust_consent_audiences from './20261020_212900_legal_decks_trust_consent_audiences';
import * as migration_20261022_104431_ayra_blogs_import from './20261022_104431_ayra_blogs_import';
import * as migration_20261022_181940_phase12_blog_review from './20261022_181940_phase12_blog_review';

export const migrations = [
  {
    up: migration_20261019_140655_baseline.up,
    down: migration_20261019_140655_baseline.down,
    name: '20261019_140655_baseline',
  },
  {
    up: migration_20261019_201653_payload_3_91_upgrade.up,
    down: migration_20261019_201653_payload_3_91_upgrade.down,
    name: '20261019_201653_payload_3_91_upgrade',
  },
  {
    up: migration_20261019_203808_blob_storage_fields.up,
    down: migration_20261019_203808_blob_storage_fields.down,
    name: '20261019_203808_blob_storage_fields',
  },
  {
    up: migration_20261019_204600_tenants_roles_api_keys.up,
    down: migration_20261019_204600_tenants_roles_api_keys.down,
    name: '20261019_204600_tenants_roles_api_keys',
  },
  {
    up: migration_20261019_205922_document_locks_off.up,
    down: migration_20261019_205922_document_locks_off.down,
    name: '20261019_205922_document_locks_off',
  },
  {
    up: migration_20261019_213214_content_model_foundation.up,
    down: migration_20261019_213214_content_model_foundation.down,
    name: '20261019_213214_content_model_foundation',
  },
  {
    up: migration_20261019_213728_pages.up,
    down: migration_20261019_213728_pages.down,
    name: '20261019_213728_pages',
  },
  {
    up: migration_20261019_215845_retire_authors_categories_post_drafts.up,
    down: migration_20261019_215845_retire_authors_categories_post_drafts.down,
    name: '20261019_215845_retire_authors_categories_post_drafts',
  },
  {
    up: migration_20261019_215903_posts_and_whats_new.up,
    down: migration_20261019_215903_posts_and_whats_new.down,
    name: '20261019_215903_posts_and_whats_new',
  },
  {
    up: migration_20261019_220955_sync_receipts_markdown_bodies.up,
    down: migration_20261019_220955_sync_receipts_markdown_bodies.down,
    name: '20261019_220955_sync_receipts_markdown_bodies',
  },
  {
    up: migration_20261020_212900_legal_decks_trust_consent_audiences.up,
    down: migration_20261020_212900_legal_decks_trust_consent_audiences.down,
    name: '20261020_212900_legal_decks_trust_consent_audiences',
  },
  {
    up: migration_20261022_104431_ayra_blogs_import.up,
    down: migration_20261022_104431_ayra_blogs_import.down,
    name: '20261022_104431_ayra_blogs_import',
  },
  {
    up: migration_20261022_181940_phase12_blog_review.up,
    down: migration_20261022_181940_phase12_blog_review.down,
    name: '20261022_181940_phase12_blog_review'
  },
];
