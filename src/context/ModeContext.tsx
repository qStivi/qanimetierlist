import { useState, type ReactNode } from 'react';
import type { EntityMode } from '../api/types';
import { DEFAULT_MODE } from '../modes';
import { loadJSON, saveJSON } from '../utils/storage';
import { ModeContext, MODE_STORAGE_KEY } from './modeContext';

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<EntityMode>(() => {
    const saved = loadJSON<string>(MODE_STORAGE_KEY, DEFAULT_MODE);
    return saved === 'anime' || saved === 'characters' ? saved : DEFAULT_MODE;
  });

  const setMode = (next: EntityMode) => {
    saveJSON(MODE_STORAGE_KEY, next);
    setModeState(next);
  };

  return <ModeContext.Provider value={{ mode, setMode }}>{children}</ModeContext.Provider>;
}
