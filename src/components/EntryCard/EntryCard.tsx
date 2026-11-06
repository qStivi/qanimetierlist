import { memo } from 'react';
import type { Entry } from '../../api/types';
import { useTierList } from '../../context/useTierList';
import styles from './EntryCard.module.css';

interface EntryCardProps {
  entry: Entry;
  isDragging?: boolean;
  onDelete: (entryId: number) => void;
}

export const EntryCard = memo(function EntryCard({ entry, isDragging = false, onDelete }: EntryCardProps) {
  const { entryName } = useTierList();
  const name = entryName(entry);

  return (
    <div className={`${styles.card} ${isDragging ? styles.dragging : ''}`}>
      <button
        type="button"
        className={styles.deleteBtn}
        title={`Remove ${name}`}
        // dnd-kit's drag listeners live on an ancestor of this button; without
        // stopping the pointer event here, a "click" to delete starts a drag instead.
        onPointerDown={e => e.stopPropagation()}
        onClick={e => {
          e.stopPropagation();
          onDelete(entry.id);
        }}
      >
        ×
      </button>
      <img
        src={entry.image.medium ?? entry.image.large}
        srcSet={
          entry.image.medium
            ? `${entry.image.medium} 100w, ${entry.image.large} 230w`
            : undefined
        }
        sizes="100px"
        width={100}
        height={140}
        alt={name}
        className={styles.image}
        loading="lazy"
        draggable={false}
      />
      <div className={styles.overlay}>
        <span className={styles.name} title={name}>
          {name}
        </span>
        <span className={styles.favourites}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 21s-6.7-4.35-9.3-8.1C.7 10.1 1.2 6.6 4 4.9c2.2-1.35 4.8-.75 6.4 1.05L12 7.7l1.6-1.75c1.6-1.8 4.2-2.4 6.4-1.05 2.8 1.7 3.3 5.2 1.3 8-2.6 3.75-9.3 8.1-9.3 8.1z" />
          </svg>
          {entry.favourites.toLocaleString()}
        </span>
      </div>
    </div>
  );
});
