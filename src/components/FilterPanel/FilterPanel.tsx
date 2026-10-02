import { useMemo, useState } from 'react';
import { useTierList } from '../../context/useTierList';
import type { CharacterFilters, ListStatus, MediaType } from '../../api/types';
import type { TierListAction } from '../../context/tierListStore';
import { getObservedGenders, UNKNOWN_GENDER } from '../../utils/filterCharacters';
import { LIST_STATUSES, MEDIA_TYPES, MEDIA_TYPE_LABELS, listKey, statusLabel } from '../../utils/listSources';
import { debounce } from '../../utils/debounce';
import styles from './FilterPanel.module.css';

export function FilterPanel() {
  const { state, dispatch } = useTierList();
  const [minFavouritesInput, setMinFavouritesInput] = useState(String(state.filters.minFavourites));

  const genderOptions = useMemo(() => getObservedGenders(state.allCharacters), [state.allCharacters]);

  // Selected lists that no loaded character came from yet — either nothing is
  // on them or they simply haven't been fetched, which only a (re)load can fix.
  const hasUnloadedLists = useMemo(() => {
    const loaded = new Set(state.allCharacters.flatMap(c => c.lists));
    return state.filters.mediaTypes.some(t => state.filters.statuses.some(s => !loaded.has(listKey(t, s))));
  }, [state.allCharacters, state.filters.mediaTypes, state.filters.statuses]);

  // Created once; takes the latest filters/dispatch as arguments at call time
  // (inside an event handler) so it never needs to read stale closed-over state.
  const [debouncedApplyMinFavourites] = useState(() =>
    debounce(
      (minFavourites: number, currentFilters: CharacterFilters, dispatchFn: (action: TierListAction) => void) => {
        dispatchFn({ type: 'SET_FILTERS', filters: { ...currentFilters, minFavourites } });
      },
      300
    )
  );

  function handleMinFavouritesChange(value: string) {
    setMinFavouritesInput(value);
    const parsed = Number(value);
    const minFavourites = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    debouncedApplyMinFavourites(minFavourites, state.filters, dispatch);
  }

  function toggleGender(gender: string) {
    const current = state.filters.genders;
    const genders = current.includes(gender) ? current.filter(g => g !== gender) : [...current, gender];
    dispatch({ type: 'SET_FILTERS', filters: { ...state.filters, genders } });
  }

  // The last remaining option in each group can't be unticked — an empty
  // selection would load and show nothing.
  function toggleSelection<T extends string>(current: T[], value: T): T[] {
    if (!current.includes(value)) return [...current, value];
    return current.length > 1 ? current.filter(v => v !== value) : current;
  }

  function toggleMediaType(mediaType: MediaType) {
    const mediaTypes = toggleSelection(state.filters.mediaTypes, mediaType);
    dispatch({ type: 'SET_FILTERS', filters: { ...state.filters, mediaTypes } });
  }

  function toggleStatus(status: ListStatus) {
    const statuses = toggleSelection(state.filters.statuses, status);
    dispatch({ type: 'SET_FILTERS', filters: { ...state.filters, statuses } });
  }

  return (
    <div className={styles.panel}>
      <label className={styles.field}>
        <span>Min. favourites</span>
        <input
          type="number"
          min={0}
          value={minFavouritesInput}
          onChange={e => handleMinFavouritesChange(e.target.value)}
          className={styles.numberInput}
        />
      </label>

      <div className={styles.field}>
        <span>Lists</span>
        <div className={styles.genderOptions}>
          {MEDIA_TYPES.map(t => (
            <label key={t} className={styles.genderOption}>
              <input type="checkbox" checked={state.filters.mediaTypes.includes(t)} onChange={() => toggleMediaType(t)} />
              {MEDIA_TYPE_LABELS[t]}
            </label>
          ))}
        </div>
      </div>

      <div className={styles.field}>
        <span>Status</span>
        <div className={styles.genderOptions}>
          {LIST_STATUSES.map(s => (
            <label key={s} className={styles.genderOption}>
              <input type="checkbox" checked={state.filters.statuses.includes(s)} onChange={() => toggleStatus(s)} />
              {statusLabel(s, state.filters.mediaTypes)}
            </label>
          ))}
        </div>
      </div>

      {hasUnloadedLists && (
        <span className={styles.hint}>
          Some selected lists have no characters loaded — click Load Characters to fetch them.
        </span>
      )}

      {genderOptions.length > 0 && (
        <div className={styles.field}>
          <span>Gender</span>
          <div className={styles.genderOptions}>
            {genderOptions.map(g => (
              <label key={g} className={styles.genderOption}>
                <input
                  type="checkbox"
                  checked={state.filters.genders.includes(g)}
                  onChange={() => toggleGender(g)}
                />
                {g === UNKNOWN_GENDER ? 'Unknown' : g}
              </label>
            ))}
          </div>
        </div>
      )}

      {state.hiddenCharacters.length > 0 && (
        <button
          type="button"
          className={styles.undoBtn}
          onClick={() => dispatch({ type: 'UNDO_DELETE' })}
          title="Undo the most recent manual removal"
        >
          ↩ Undo remove "{state.hiddenCharacters[state.hiddenCharacters.length - 1].character.name.full}"
        </button>
      )}

      <span className={styles.count}>{state.characters.length} shown</span>
    </div>
  );
}
