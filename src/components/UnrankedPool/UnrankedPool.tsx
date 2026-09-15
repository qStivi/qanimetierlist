import { useDroppable } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import type { Character } from '../../api/types';
import { SortableCharacter } from '../SortableCharacter';
import { POOL_CONTAINER_ID } from '../../utils/containerIds';
import styles from './UnrankedPool.module.css';

interface UnrankedPoolProps {
  characters: Character[];
}

export function UnrankedPool({ characters }: UnrankedPoolProps) {
  const { setNodeRef, isOver } = useDroppable({ id: POOL_CONTAINER_ID });

  return (
    <div className={styles.pool}>
      <div className={styles.header}>
        <span>Unranked</span>
        <span className={styles.count}>{characters.length}</span>
      </div>
      <div ref={setNodeRef} className={`${styles.dropzone} ${isOver ? styles.dropzoneOver : ''}`}>
        <SortableContext items={characters.map(c => String(c.id))} strategy={rectSortingStrategy}>
          {characters.length === 0 ? (
            <p className={styles.empty}>Load some AniList usernames above to see their favourite characters here.</p>
          ) : (
            characters.map(c => <SortableCharacter key={c.id} character={c} />)
          )}
        </SortableContext>
      </div>
    </div>
  );
}
