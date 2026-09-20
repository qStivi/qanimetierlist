import { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import type { Character } from '../../api/types';
import { SortableCharacter } from '../SortableCharacter';
import { POOL_CONTAINER_ID } from '../../utils/containerIds';
import styles from './UnrankedPool.module.css';

interface UnrankedPoolProps {
  characters: Character[];
  onDelete: (characterId: number) => void;
  onShuffle: () => void;
}

export function UnrankedPool({ characters, onDelete, onShuffle }: UnrankedPoolProps) {
  const { setNodeRef, isOver } = useDroppable({ id: POOL_CONTAINER_ID });
  // A fresh array reference on every render (even with identical ids) makes
  // dnd-kit think the sortable set changed and re-measure droppables, which
  // under fast dragging can cascade into a render loop — see TierRow.
  const itemIds = useMemo(() => characters.map(c => String(c.id)), [characters]);

  return (
    <div className={styles.pool}>
      <div className={styles.header}>
        <span>Unranked</span>
        <span className={styles.count}>{characters.length}</span>
        <button
          type="button"
          className={styles.shuffleBtn}
          onClick={onShuffle}
          disabled={characters.length < 2}
          title="Shuffle the unranked order"
        >
          🔀 Randomize
        </button>
      </div>
      <div ref={setNodeRef} className={`${styles.dropzone} ${isOver ? styles.dropzoneOver : ''}`}>
        <SortableContext items={itemIds} strategy={rectSortingStrategy}>
          {characters.length === 0 ? (
            <p className={styles.empty}>Load some AniList usernames above to see characters from their finished anime here.</p>
          ) : (
            characters.map(c => <SortableCharacter key={c.id} character={c} onDelete={onDelete} />)
          )}
        </SortableContext>
      </div>
    </div>
  );
}
