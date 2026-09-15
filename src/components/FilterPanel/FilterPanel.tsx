import { useMemo, useState } from 'react';
import { useTierList } from '../../context/useTierList';
import type { CharacterFilters } from '../../api/types';
import type { TierListAction } from '../../context/tierListStore';
import { getObservedGenders } from '../../utils/filterCharacters';
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

  function handleGenderChange(value: string) {
    dispatch({ type: 'SET_FILTERS', filters: { ...state.filters, gender: value } });
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

      <label className={styles.field}>
        <span>Gender</span>
        <select value={state.filters.gender} onChange={e => handleGenderChange(e.target.value)} className={styles.select}>
          <option value="ANY">Any</option>
          {genderOptions.map(g => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </label>

      <span className={styles.count}>{state.characters.length} shown</span>
    </div>
  );
}
