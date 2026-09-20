import { useEffect, useMemo, useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import type { Character, Tier } from '../../api/types';
import { SortableCharacter } from '../SortableCharacter';
import { containerIdForTier } from '../../utils/containerIds';
import styles from './TierRow.module.css';

// Fallback for a color-input value when a tier somehow has no color set
// (the input element itself requires a valid hex string, never undefined).
const DEFAULT_TIER_COLOR = '#cfd3e0';

interface TierRowProps {
  tier: Tier;
  characters: Character[];
  onRename: (label: string) => void;
  onDelete: (characterId: number) => void;
  onRemoveTier: () => void;
  onRecolor: (color: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  /** False if this tier holds any character, even one hidden by an active filter. */
  canRemoveTier: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export function TierRow({
  tier,
  characters,
  onRename,
  onDelete,
  onRemoveTier,
  onRecolor,
  onMoveUp,
  onMoveDown,
  canRemoveTier,
  canMoveUp,
  canMoveDown,
}: TierRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(tier.label);
  const inputRef = useRef<HTMLInputElement>(null);

  const { setNodeRef, isOver } = useDroppable({ id: containerIdForTier(tier.id) });
  // A fresh array reference on every render (even with identical ids) makes
  // dnd-kit think the sortable set changed and re-measure droppables — under
  // fast/erratic dragging across many tier boundaries that can cascade into
  // a "Maximum update depth exceeded" render loop.
  const itemIds = useMemo(() => characters.map(c => String(c.id)), [characters]);

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
        <input
          type="color"
          className={styles.colorInput}
          value={tier.color ?? DEFAULT_TIER_COLOR}
          onClick={e => e.stopPropagation()}
          onChange={e => onRecolor(e.target.value)}
          title="Tier color"
        />
        <button
          type="button"
          className={styles.removeBtn}
          onClick={e => {
            e.stopPropagation();
            onRemoveTier();
          }}
          disabled={!canRemoveTier}
          title={canRemoveTier ? 'Remove tier' : 'Move or delete its characters first to remove this tier'}
        >
          ×
        </button>
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
        <div className={styles.moveButtons}>
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onMoveUp();
            }}
            disabled={!canMoveUp}
            title="Move tier up"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onMoveDown();
            }}
            disabled={!canMoveDown}
            title="Move tier down"
          >
            ▼
          </button>
        </div>
      </div>
      <div ref={setNodeRef} className={`${styles.dropzone} ${isOver ? styles.dropzoneOver : ''}`}>
        <SortableContext items={itemIds} strategy={horizontalListSortingStrategy}>
          {characters.map(c => (
            <SortableCharacter key={c.id} character={c} onDelete={onDelete} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
