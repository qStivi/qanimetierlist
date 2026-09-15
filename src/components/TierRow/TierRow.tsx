import { useEffect, useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import type { Character, Tier } from '../../api/types';
import { SortableCharacter } from '../SortableCharacter';
import { containerIdForTier } from '../../utils/containerIds';
import styles from './TierRow.module.css';

interface TierRowProps {
  tier: Tier;
  characters: Character[];
  onRename: (label: string) => void;
}

export function TierRow({ tier, characters, onRename }: TierRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(tier.label);
  const inputRef = useRef<HTMLInputElement>(null);

  const { setNodeRef, isOver } = useDroppable({ id: containerIdForTier(tier.id) });

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  function handleDoubleClick() {
    setEditValue(tier.label);
    setIsEditing(true);
  }

  function commit() {
    if (editValue.trim() && editValue !== tier.label) {
      onRename(editValue.trim());
    }
    setIsEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      commit();
    } else if (e.key === 'Escape') {
      setEditValue(tier.label);
      setIsEditing(false);
    }
  }

  return (
    <div className={styles.row}>
      <div className={styles.label} style={{ background: tier.color }} onDoubleClick={handleDoubleClick}>
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            className={styles.labelInput}
          />
        ) : (
          <span title="Double-click to rename">{tier.label}</span>
        )}
      </div>
      <div ref={setNodeRef} className={`${styles.dropzone} ${isOver ? styles.dropzoneOver : ''}`}>
        <SortableContext items={characters.map(c => String(c.id))} strategy={horizontalListSortingStrategy}>
          {characters.map(c => (
            <SortableCharacter key={c.id} character={c} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
