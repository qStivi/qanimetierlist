import { useState } from 'react';
import { useTierList } from '../../context/useTierList';
import styles from './HiddenCharacters.module.css';

export function HiddenCharacters() {
  const { state, dispatch, entryName } = useTierList();
  const [isOpen, setIsOpen] = useState(false);
  const [idInput, setIdInput] = useState('');
  const [unhideMessage, setUnhideMessage] = useState<string | null>(null);

  const hidden = state.hiddenEntries;

  function handleUnhideById() {
    const entryId = Number(idInput.trim());
    if (!Number.isInteger(entryId) || entryId <= 0) return;

    if (!state.deletedIds.includes(entryId)) {
      setUnhideMessage(`Entry ${entryId} isn't currently hidden.`);
      return;
    }

    dispatch({ type: 'UNHIDE_ENTRY_ID', entryId });
    setIdInput('');
    setUnhideMessage(
      `Un-hid entry ${entryId} — load again to bring it back if it's still on a selected list.`
    );
  }

  return (
    <div className={styles.panel}>
      <button type="button" className={styles.toggleBtn} onClick={() => setIsOpen(o => !o)}>
        {isOpen ? '▾' : '▸'} Hidden ({hidden.length})
      </button>

      <div className={styles.restoreByIdRow}>
        <input
          type="number"
          min={1}
          placeholder="AniList ID"
          value={idInput}
          onChange={e => setIdInput(e.target.value)}
          className={styles.idInput}
          title="For entries hidden before this browsable list existed"
        />
        <button type="button" className={styles.restoreBtn} onClick={handleUnhideById}>
          Un-hide by ID
        </button>
      </div>
      {unhideMessage && <p className={styles.hint}>{unhideMessage}</p>}

      {isOpen && (
        <div className={styles.list}>
          {hidden.length === 0 ? (
            <p className={styles.empty}>No hidden entries.</p>
          ) : (
            [...hidden].reverse().map(({ entry }) => (
              <div key={entry.id} className={styles.row}>
                <img
                  src={entry.image.medium ?? entry.image.large}
                  width={32}
                  height={32}
                  alt={entryName(entry)}
                  className={styles.thumb}
                />
                <span className={styles.name} title={entryName(entry)}>
                  {entryName(entry)}
                </span>
                <button
                  type="button"
                  className={styles.restoreBtn}
                  onClick={() => dispatch({ type: 'RESTORE_ENTRY', entryId: entry.id })}
                >
                  Restore
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
