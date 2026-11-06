import { useMemo, useState } from 'react';
import { useTierList } from '../../context/useTierList';
import { useMode } from '../../context/useMode';
import type { AnimeFilters, Character, CharacterFilters, ListStatus, MediaType } from '../../api/types';
import type { TierListAction } from '../../context/tierListStore';
import { getObservedGenders, UNKNOWN_GENDER } from '../../utils/filterCharacters';
import { LIST_STATUSES, MEDIA_TYPES, MEDIA_TYPE_LABELS, listKey, statusLabel } from '../../utils/listSources';
import { debounce } from '../../utils/debounce';
import styles from './FilterPanel.module.css';

const ANIME_ONLY: MediaType[] = ['ANIME'];

export function FilterPanel() {
  const { state, dispatch, entryName } = useTierList();
  const { mode } = useMode();
  const isCharacters = mode === 'characters';

  const charFilters = state.filters as CharacterFilters;
  const animeFilters = state.filters as AnimeFilters;
  const mediaTypes = isCharacters ? charFilters.mediaTypes : ANIME_ONLY;

  const [minValueInput, setMinValueInput] = useState(String(isCharacters ? charFilters.minFavourites : animeFilters.minScore));

  const genderOptions = useMemo(
    () => (isCharacters ? getObservedGenders(state.allEntries as Character[]) : []),
    [isCharacters, state.allEntries]
  );

  // Usernames worth filtering by: everyone whose lists were loaded, plus
  // anyone entries actually came from (a loaded user with no matching
  // entries still shows up so the filter can be narrowed to them).
  const userOptions = useMemo(() => {
    const observed = new Set(state.allEntries.flatMap(e => e.sourceUsernames));
    for (const u of state.usernames) observed.add(u);
    return Array.from(observed).sort();
  }, [state.allEntries, state.usernames]);

  // Selected lists that no loaded entry came from yet — either nothing is
  // on them or they simply haven't been fetched, which only a (re)load can fix.
  const hasUnloadedLists = useMemo(() => {
    const loaded = new Set(state.allEntries.flatMap(e => e.lists));
    return mediaTypes.some(t => state.filters.statuses.some(s => !loaded.has(listKey(t, s))));
  }, [state.allEntries, mediaTypes, state.filters.statuses]);

  // Created once; takes the latest filters/dispatch as arguments at call time
  // (inside an event handler) so it never needs to read stale closed-over state.
  const [debouncedApplyMinValue] = useState(() =>
    debounce(
      (minValue: number, currentFilters: CharacterFilters | AnimeFilters, dispatchFn: (action: TierListAction) => void) => {
        const key = mode === 'anime' ? 'minScore' : 'minFavourites';
        dispatchFn({ type: 'SET_FILTERS', filters: { ...currentFilters, [key]: minValue } });
      },
      300
    )
  );

  function handleMinValueChange(value: string) {
    setMinValueInput(value);
    const parsed = Number(value);
    const minValue = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    debouncedApplyMinValue(minValue, state.filters, dispatch);
  }

  function toggleGender(gender: string) {
    const current = charFilters.genders;
    const genders = current.includes(gender) ? current.filter(g => g !== gender) : [...current, gender];
    dispatch({ type: 'SET_FILTERS', filters: { ...charFilters, genders } });
  }

  // The last remaining option in each group can't be unticked — an empty
  // selection would load and show nothing.
  function toggleSelection<T extends string>(current: T[], value: T): T[] {
    if (!current.includes(value)) return [...current, value];
    return current.length > 1 ? current.filter(v => v !== value) : current;
  }

  function toggleMediaType(mediaType: MediaType) {
    const next = toggleSelection(charFilters.mediaTypes, mediaType);
    dispatch({ type: 'SET_FILTERS', filters: { ...charFilters, mediaTypes: next } });
  }

  function toggleStatus(status: ListStatus) {
    const statuses = toggleSelection(state.filters.statuses, status);
    dispatch({
      type: 'SET_FILTERS',
      filters: isCharacters ? { ...charFilters, statuses } : { ...animeFilters, statuses },
    });
  }

  // Unlike statuses, the user filter may be empty — empty means "show every user".
  function toggleUser(user: string) {
    const current = state.filters.usernames;
    const usernames = current.includes(user) ? current.filter(u => u !== user) : [...current, user];
    dispatch({ type: 'SET_FILTERS', filters: { ...state.filters, usernames } });
  }

  return (
    <div className={styles.panel}>
      <label className={styles.field}>
        <span>{isCharacters ? 'Min. favourites' : 'Min. score (0–100)'}</span>
        <input
          type="number"
          min={0}
          max={isCharacters ? undefined : 100}
          value={minValueInput}
          onChange={e => handleMinValueChange(e.target.value)}
          className={styles.numberInput}
        />
      </label>

      {isCharacters && (
        <div className={styles.field}>
          <span>Lists</span>
          <div className={styles.genderOptions}>
            {MEDIA_TYPES.map(t => (
              <label key={t} className={styles.genderOption}>
                <input
                  type="checkbox"
                  checked={charFilters.mediaTypes.includes(t)}
                  onChange={() => toggleMediaType(t)}
                />
                {MEDIA_TYPE_LABELS[t]}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className={styles.field}>
        <span>Status</span>
        <div className={styles.genderOptions}>
          {LIST_STATUSES.map(s => (
            <label key={s} className={styles.genderOption}>
              <input
                type="checkbox"
                checked={state.filters.statuses.includes(s)}
                onChange={() => toggleStatus(s)}
              />
              {statusLabel(s, mediaTypes)}
            </label>
          ))}
        </div>
      </div>

      {userOptions.length > 0 && (
        <div className={styles.field}>
          <span>Users</span>
          <div className={styles.genderOptions}>
            {userOptions.map(u => (
              <label key={u} className={styles.genderOption}>
                <input
                  type="checkbox"
                  checked={state.filters.usernames.length === 0 || state.filters.usernames.includes(u)}
                  onChange={() => toggleUser(u)}
                />
                {u}
              </label>
            ))}
          </div>
        </div>
      )}

      {hasUnloadedLists && (
        <span className={styles.hint}>
          Some selected lists have no entries loaded — click {isCharacters ? 'Load Characters' : 'Load Anime'} to fetch them.
        </span>
      )}

      {isCharacters && genderOptions.length > 0 && (
        <div className={styles.field}>
          <span>Gender</span>
          <div className={styles.genderOptions}>
            {genderOptions.map(g => (
              <label key={g} className={styles.genderOption}>
                <input
                  type="checkbox"
                  checked={charFilters.genders.includes(g)}
                  onChange={() => toggleGender(g)}
                />
                {g === UNKNOWN_GENDER ? 'Unknown' : g}
              </label>
            ))}
          </div>
        </div>
      )}

      {state.hiddenEntries.length > 0 && (
        <button
          type="button"
          className={styles.undoBtn}
          onClick={() => dispatch({ type: 'UNDO_DELETE' })}
          title="Undo the most recent manual removal"
        >
          ↩ Undo remove "{entryName(state.hiddenEntries[state.hiddenEntries.length - 1].entry)}"
        </button>
      )}

      <span className={styles.count}>{state.entries.length} shown</span>
    </div>
  );
}
