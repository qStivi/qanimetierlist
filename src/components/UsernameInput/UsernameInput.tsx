import { useState } from 'react';
import { useTierList } from '../../context/useTierList';
import { getAllFavouriteCharacters } from '../../api/anilist';
import { dedupeCharacters, type FetchedForUser } from '../../utils/characterUtils';
import styles from './UsernameInput.module.css';

export function UsernameInput() {
  const { state, dispatch } = useTierList();
  const [pendingUsernames, setPendingUsernames] = useState<string[]>(state.usernames);
  const [inputValue, setInputValue] = useState('');
  const [perUserError, setPerUserError] = useState<Record<string, string>>({});

  function addUsername() {
    const name = inputValue.trim();
    if (!name || pendingUsernames.some(u => u.toLowerCase() === name.toLowerCase())) {
      setInputValue('');
      return;
    }
    setPendingUsernames(prev => [...prev, name]);
    setInputValue('');
  }

  function removeUsername(name: string) {
    setPendingUsernames(prev => prev.filter(u => u !== name));
  }

  async function handleLoad() {
    if (pendingUsernames.length === 0) return;

    dispatch({ type: 'FETCH_START', usernames: pendingUsernames });
    setPerUserError({});

    const fetched: FetchedForUser[] = [];
    const errors: Record<string, string> = {};

    // Fetched sequentially (not in parallel) so the shared rate limiter's
    // request-window tracking stays accurate across all usernames.
    for (const username of pendingUsernames) {
      try {
        const characters = await getAllFavouriteCharacters(username);
        fetched.push({ username, characters });
      } catch (err) {
        errors[username] = err instanceof Error ? err.message : 'Failed to load';
      }
    }

    setPerUserError(errors);

    if (fetched.length === 0) {
      dispatch({ type: 'FETCH_ERROR', error: 'None of the usernames could be loaded.' });
      return;
    }

    dispatch({ type: 'FETCH_SUCCESS', characters: dedupeCharacters(fetched) });
  }

  return (
    <div className={styles.panel}>
      <div className={styles.inputRow}>
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') addUsername();
          }}
          placeholder="AniList username"
          className={styles.input}
        />
        <button className={styles.addBtn} onClick={addUsername}>
          + Add
        </button>
        <button className={styles.loadBtn} onClick={handleLoad} disabled={state.isLoading || pendingUsernames.length === 0}>
          {state.isLoading ? 'Loading…' : 'Load Favorites'}
        </button>
      </div>

      {pendingUsernames.length > 0 && (
        <div className={styles.chips}>
          {pendingUsernames.map(name => (
            <span key={name} className={styles.chip}>
              {name}
              {perUserError[name] && <span className={styles.chipError} title={perUserError[name]}>⚠</span>}
              <button className={styles.chipRemove} onClick={() => removeUsername(name)} title="Remove">
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {state.error && <p className={styles.error}>{state.error}</p>}
      {Object.entries(perUserError).map(([name, message]) => (
        <p key={name} className={styles.error}>
          {name}: {message}
        </p>
      ))}
    </div>
  );
}
