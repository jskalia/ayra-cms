import * as migration_20261019_140655_baseline from './20261019_140655_baseline';
import * as migration_20261019_201653_payload_3_91_upgrade from './20261019_201653_payload_3_91_upgrade';
import * as migration_20261019_203808_blob_storage_fields from './20261019_203808_blob_storage_fields';
import * as migration_20261019_204600_tenants_roles_api_keys from './20261019_204600_tenants_roles_api_keys';
import * as migration_20261019_205922_document_locks_off from './20261019_205922_document_locks_off';
import * as migration_20261019_213214_content_model_foundation from './20261019_213214_content_model_foundation';

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
    name: '20261019_213214_content_model_foundation'
  },
];
