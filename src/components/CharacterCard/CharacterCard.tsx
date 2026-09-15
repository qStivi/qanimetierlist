import { memo } from 'react';
import type { Character } from '../../api/types';
import styles from './CharacterCard.module.css';

interface CharacterCardProps {
  character: Character;
  isDragging?: boolean;
}

export const CharacterCard = memo(function CharacterCard({ character, isDragging = false }: CharacterCardProps) {
  return (
    <div className={`${styles.card} ${isDragging ? styles.dragging : ''}`}>
      <img
        src={character.image.large}
        alt={character.name.full}
        className={styles.image}
        loading="lazy"
        draggable={false}
      />
      <div className={styles.overlay}>
        <span className={styles.name} title={character.name.full}>
          {character.name.full}
        </span>
        <span className={styles.favourites}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21s-6.7-4.35-9.3-8.1C.7 10.1 1.2 6.6 4 4.9c2.2-1.35 4.8-.75 6.4 1.05L12 7.7l1.6-1.75c1.6-1.8 4.2-2.4 6.4-1.05 2.8 1.7 3.3 5.2 1.3 8-2.6 3.75-9.3 8.1-9.3 8.1z" />
          </svg>
          {character.favourites.toLocaleString()}
        </span>
      </div>
    </div>
  );
});
