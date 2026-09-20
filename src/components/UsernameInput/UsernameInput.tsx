import { useState } from 'react';
import { useTierList } from '../../context/useTierList';
import { getAllFinishedCharacters } from '../../api/anilist';
import { formatEta } from '../../utils/formatTime';
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

    const errors: Record<string, string> = {};
    let anySucceeded = false;

    // Fetched sequentially (not in parallel) so the shared rate limiter's
    // request-window tracking stays accurate across all usernames.
    for (let i = 0; i < pendingUsernames.length; i++) {
      const username = pendingUsernames[i];
      try {
        await getAllFinishedCharacters(
          username,
          state.filters.minFavourites,
          progress => {
            dispatch({
              type: 'FETCH_PROGRESS',
              progress: { ...progress, username, usernameIndex: i, usernameCount: pendingUsernames.length },
            });
          },
          batch => dispatch({ type: 'MERGE_CHARACTERS', username, characters: batch })
        );
        anySucceeded = true;
      } catch (err) {
        errors[username] = err instanceof Error ? err.message : 'Failed to load';
      }
    }

    setPerUserError(errors);

    if (!anySucceeded) {
      dispatch({ type: 'FETCH_ERROR', error: 'None of the usernames could be loaded.' });
      return;
    }

    dispatch({ type: 'FETCH_DONE' });
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
          {state.isLoading ? 'Loading…' : 'Load Characters'}
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

      {state.loadProgress && (
        <div className={styles.progress}>
          <p className={styles.progressLabel}>
            Loading {state.loadProgress.username}
            {state.loadProgress.usernameCount > 1 &&
              ` (user ${state.loadProgress.usernameIndex + 1}/${state.loadProgress.usernameCount})`}
            : {state.loadProgress.processedAnime}/{state.loadProgress.totalAnime} anime —{' '}
            {formatEta(state.loadProgress.etaSeconds)}
          </p>
          <progress
            className={styles.progressBar}
            value={state.loadProgress.processedAnime}
            max={state.loadProgress.totalAnime}
          />
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
