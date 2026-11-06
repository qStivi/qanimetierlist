import { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import type { Entry } from '../../api/types';
import { SortableEntry } from '../SortableEntry';
import { POOL_CONTAINER_ID } from '../../utils/containerIds';
import styles from './UnrankedPool.module.css';

interface UnrankedPoolProps {
  entries: Entry[];
  onDelete: (entryId: number) => void;
  onShuffle: () => void;
}

export function UnrankedPool({ entries, onDelete, onShuffle }: UnrankedPoolProps) {
  const { setNodeRef, isOver } = useDroppable({ id: POOL_CONTAINER_ID });
  // A fresh array reference on every render (even with identical ids) makes
  // dnd-kit think the sortable set changed and re-measure droppables, which
  // under fast dragging can cascade into a render loop — see TierRow.
  const itemIds = useMemo(() => entries.map(e => String(e.id)), [entries]);

  return (
    <div className={styles.pool}>
      <div className={styles.header}>
        <span>Unranked</span>
        <span className={styles.count}>{entries.length}</span>
        <button
          type="button"
          className={styles.shuffleBtn}
          onClick={onShuffle}
          disabled={entries.length < 2}
          title="Shuffle the unranked order"
        >
          🔀 Randomize
        </button>
      </div>
      <div ref={setNodeRef} className={`${styles.dropzone} ${isOver ? styles.dropzoneOver : ''}`}>
        <SortableContext items={itemIds} strategy={rectSortingStrategy}>
          {entries.length === 0 ? (
            <p className={styles.empty}>Load some AniList usernames above to see entries from their lists here.</p>
          ) : (
            entries.map(e => <SortableEntry key={e.id} entry={e} onDelete={onDelete} />)
          )}
        </SortableContext>
      </div>
    </div>
  );
}
