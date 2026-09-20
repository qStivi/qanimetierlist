import { useMemo, useState } from 'react';
import { useTierList } from '../../context/useTierList';
import type { CharacterFilters } from '../../api/types';
import type { TierListAction } from '../../context/tierListStore';
import { getObservedGenders, UNKNOWN_GENDER } from '../../utils/filterCharacters';
import { debounce } from '../../utils/debounce';
import styles from './FilterPanel.module.css';

export function FilterPanel() {
  const { state, dispatch } = useTierList();
  const [minFavouritesInput, setMinFavouritesInput] = useState(String(state.filters.minFavourites));

  const genderOptions = useMemo(() => getObservedGenders(state.allCharacters), [state.allCharacters]);

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
