import type { EntityMode } from '../api/types';

/** The localStorage keys one mode's persisted state is spread across. */
export interface StorageKeys {
  tiers: string;
  assignments: string;
  usernames: string;
  filters: string;
  cache: string;
  deletedIds: string;
  hidden: string;
  order: string;
}

/**
 * Characters mode keeps the historical unprefixed keys so existing users'
 * saved tier lists are found without a migration. Every other mode gets its
 * own prefixed key set, so modes never clobber each other.
 */
export const CHARACTERS_STORAGE_KEYS: StorageKeys = {
  tiers: 'tierlist_tiers',
  assignments: 'tierlist_assignments',
  usernames: 'tierlist_usernames',
  filters: 'tierlist_filters',
  cache: 'tierlist_characters_cache',
  deletedIds: 'tierlist_deleted_ids',
  hidden: 'tierlist_hidden_characters',
  order: 'tierlist_order',
};

export function storageKeysFor(mode: EntityMode): StorageKeys {
  if (mode === 'characters') return CHARACTERS_STORAGE_KEYS;
  const prefix = `tierlist_${mode}_`;
  return {
    tiers: `${prefix}tiers`,
    assignments: `${prefix}assignments`,
    usernames: `${prefix}usernames`,
    filters: `${prefix}filters`,
    cache: `${prefix}cache`,
    deletedIds: `${prefix}deleted_ids`,
    hidden: `${prefix}hidden`,
    order: `${prefix}order`,
  };
}
