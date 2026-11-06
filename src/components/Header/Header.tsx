import type { EntityMode } from '../../api/types';
import { useMode } from '../../context/useMode';
import styles from './Header.module.css';

const MODES: { mode: EntityMode; label: string; subtitle: string }[] = [
  { mode: 'characters', label: 'Characters', subtitle: 'Build a character tier list from your finished AniList anime' },
  { mode: 'anime', label: 'Anime', subtitle: 'Build an anime tier list from your AniList lists' },
];

export function Header() {
  const { mode, setMode } = useMode();

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>qanimetierlist</h1>
      <div className={styles.modeSwitch}>
        {MODES.map(m => (
          <button
            key={m.mode}
            type="button"
            className={`${styles.modeBtn} ${mode === m.mode ? styles.modeBtnActive : ''}`}
            onClick={() => setMode(m.mode)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className={styles.subtitle}>{MODES.find(m => m.mode === mode)?.subtitle}</p>
    </header>
  );
}
