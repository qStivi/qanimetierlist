import { useState } from 'react';
import { useTierList } from '../../context/useTierList';
import styles from './HiddenCharacters.module.css';

export function HiddenCharacters() {
  const { state, dispatch } = useTierList();
  const [isOpen, setIsOpen] = useState(false);
  const [idInput, setIdInput] = useState('');
  const [unhideMessage, setUnhideMessage] = useState<string | null>(null);

  const hidden = state.hiddenCharacters;

  function handleUnhideById() {
    const characterId = Number(idInput.trim());
    if (!Number.isInteger(characterId) || characterId <= 0) return;

    if (!state.deletedIds.includes(characterId)) {
      setUnhideMessage(`Character ${characterId} isn't currently hidden.`);
      return;
    }

    dispatch({ type: 'UNHIDE_CHARACTER_ID', characterId });
    setIdInput('');
    setUnhideMessage(
      `Un-hid character ${characterId} — click "Load Characters" again to bring it back if it's still in a completed anime.`
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
          placeholder="AniList character ID"
          value={idInput}
          onChange={e => setIdInput(e.target.value)}
          className={styles.idInput}
          title="For characters hidden before this browsable list existed"
        />
        <button type="button" className={styles.restoreBtn} onClick={handleUnhideById}>
          Un-hide by ID
        </button>
      </div>
      {unhideMessage && <p className={styles.hint}>{unhideMessage}</p>}

      {isOpen && (
        <div className={styles.list}>
          {hidden.length === 0 ? (
            <p className={styles.empty}>No hidden characters.</p>
          ) : (
            [...hidden].reverse().map(({ character }) => (
              <div key={character.id} className={styles.row}>
                <img src={character.image.large} alt={character.name.full} className={styles.thumb} />
                <span className={styles.name} title={character.name.full}>
                  {character.name.full}
                </span>
                <button
                  type="button"
                  className={styles.restoreBtn}
                  onClick={() => dispatch({ type: 'RESTORE_CHARACTER', characterId: character.id })}
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
