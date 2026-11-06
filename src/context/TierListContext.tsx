import { useMemo, useReducer, type ReactNode } from 'react';
import type { AnimeEntry, Character, EntityMode, Entry } from '../api/types';
import { animeAdapter, characterAdapter } from '../modes';
import { TierListContext, createTierListReducer, initTierListState } from './tierListStore';

export function TierListProvider({ mode, children }: { mode: EntityMode; children: ReactNode }) {
  // Remounted by App via key={mode} on switch, so the reducer (and its
  // closed-over adapter/storage keys) is always for the active mode.
  const reducer = useMemo(() => createTierListReducer(mode), [mode]);
  const [state, dispatch] = useReducer(reducer, mode, initTierListState);

  const entryName = useMemo(
    () =>
      mode === 'anime'
        ? (entry: Entry) => animeAdapter.getEntryName(entry as AnimeEntry)
        : (entry: Entry) => characterAdapter.getEntryName(entry as Character),
    [mode]
  );
  const entryUrl = useMemo(
    () =>
      mode === 'anime'
        ? (entry: Entry) => animeAdapter.getEntryUrl(entry as AnimeEntry)
        : (entry: Entry) => characterAdapter.getEntryUrl(entry as Character),
    [mode]
  );

  return <TierListContext.Provider value={{ state, dispatch, mode, entryName, entryUrl }}>{children}</TierListContext.Provider>;
}
