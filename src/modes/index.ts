import type { EntityMode } from '../api/types';
import { characterAdapter, type CharacterAdapter } from './characters';
import { animeAdapter, type AnimeAdapter } from './anime';

/** The mode the app loads into when no mode has been chosen yet. */
export const DEFAULT_MODE: EntityMode = 'characters';

export function getAdapter(mode: 'characters'): CharacterAdapter;
export function getAdapter(mode: 'anime'): AnimeAdapter;
export function getAdapter(mode: EntityMode): CharacterAdapter | AnimeAdapter {
  return mode === 'anime' ? animeAdapter : characterAdapter;
}

export { characterAdapter, animeAdapter };
