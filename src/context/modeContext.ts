import { createContext } from 'react';
import type { EntityMode } from '../api/types';

export interface ModeContextType {
  mode: EntityMode;
  setMode: (mode: EntityMode) => void;
}

export const MODE_STORAGE_KEY = 'tierlist_mode';

export const ModeContext = createContext<ModeContextType | null>(null);
