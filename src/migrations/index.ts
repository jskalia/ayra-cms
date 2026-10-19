import * as migration_20261019_140655_baseline from './20261019_140655_baseline';
import * as migration_20261019_201653_payload_3_91_upgrade from './20261019_201653_payload_3_91_upgrade';

export const migrations = [
  {
    up: migration_20261019_140655_baseline.up,
    down: migration_20261019_140655_baseline.down,
    name: '20261019_140655_baseline',
  },
  {
    up: migration_20261019_201653_payload_3_91_upgrade.up,
    down: migration_20261019_201653_payload_3_91_upgrade.down,
    name: '20261019_201653_payload_3_91_upgrade'
  },
];
