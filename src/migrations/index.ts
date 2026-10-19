import * as migration_20261019_140655_baseline from './20261019_140655_baseline';

export const migrations = [
  {
    up: migration_20261019_140655_baseline.up,
    down: migration_20261019_140655_baseline.down,
    name: '20261019_140655_baseline'
  },
];
