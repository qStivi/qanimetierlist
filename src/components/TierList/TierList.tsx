import { useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useTierList } from '../../context/useTierList';
import { TierRow } from '../TierRow';
import { UnrankedPool } from '../UnrankedPool';
import { EntryCard } from '../EntryCard';
import { CONTAINER_PREFIX, toContainerKey, fromContainerKey } from '../../utils/containerIds';
import styles from './TierList.module.css';

// Module-level (stable reference) so it never causes DndContext to think its
// config changed. Droppables are only measured once a drag starts rather
// than continuously while dragging — the default (WhileDragging) re-measures
// on every frame, and under fast/erratic dragging near tier boundaries that
// was cascading into a "Maximum update depth exceeded" render loop.
const MEASURING_CONFIG = {
  droppable: { strategy: MeasuringStrategy.BeforeDragging },
};

export function TierList() {
  const { state, dispatch } = useTierList();
  const [dragOverride, setDragOverride] = useState<Record<number, string | null> | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const entries = state.entries;
  const tiers = state.tiers;
  const assignments = state.assignments;

  // Stable across renders (dispatch never changes) so it doesn't defeat
  // EntryCard's memoization for entries unrelated to a given delete.
  const handleDelete = useCallback(
    (entryId: number) => dispatch({ type: 'DELETE_ENTRY', entryId }),
    [dispatch]
  );

  const handleShuffle = useCallback(() => dispatch({ type: 'SHUFFLE_POOL' }), [dispatch]);
  const handleAddTier = useCallback(() => dispatch({ type: 'ADD_TIER' }), [dispatch]);
  const handleRemoveTier = useCallback((tierId: string) => dispatch({ type: 'REMOVE_TIER', tierId }), [dispatch]);
  const handleRecolorTier = useCallback(
    (tierId: string, color: string) => dispatch({ type: 'SET_TIER_COLOR', tierId, color }),
    [dispatch]
  );
  const handleMoveTier = useCallback(
    (tierId: string, direction: 'up' | 'down') => dispatch({ type: 'MOVE_TIER', tierId, direction }),
    [dispatch]
  );

  // Deliberately from state.assignments (every entry), not the
  // filtered/displayed `entries` — an entry hidden by an active
  // filter still occupies its tier and must still block removal.
  const nonEmptyTierIds = useMemo(() => new Set(Object.values(assignments).filter((t): t is string => t !== null)), [
    assignments,
  ]);

  const effectiveAssignments = useMemo(
    () => (dragOverride ? { ...assignments, ...dragOverride } : assignments),
    [assignments, dragOverride]
  );

  const byContainer = useMemo(() => {
    const map = new Map<string, typeof entries>();
    map.set('pool', []);
    for (const tier of tiers) map.set(tier.id, []);
    for (const e of entries) {
      const key = toContainerKey(effectiveAssignments[e.id] ?? null);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [entries, tiers, effectiveAssignments]);

  function resolveContainerKey(id: string): string {
    if (id.startsWith(CONTAINER_PREFIX)) return id.slice(CONTAINER_PREFIX.length);
    const charId = Number(id);
    return toContainerKey(effectiveAssignments[charId] ?? null);
  }

  const activeEntry = useMemo(
    () => (activeId !== null ? (entries.find(e => e.id === activeId) ?? null) : null),
    [entries, activeId]
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(Number(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = Number(active.id);
    const activeKey = toContainerKey(effectiveAssignments[activeId] ?? null);
    const overKey = resolveContainerKey(String(over.id));

    if (activeKey !== overKey) {
      setDragOverride(prev => ({ ...(prev ?? {}), [activeId]: fromContainerKey(overKey) }));
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const draggedId = Number(active.id);
    const finalOverride = dragOverride;
    setDragOverride(null);
    setActiveId(null);

    const finalTierId = finalOverride && draggedId in finalOverride
      ? finalOverride[draggedId]
      : state.assignments[draggedId] ?? null;

    if ((state.assignments[draggedId] ?? null) !== finalTierId) {
      dispatch({ type: 'MOVE_ENTRY', entryId: draggedId, tierId: finalTierId });
    }

    if (!over) return;

    const containerKey = toContainerKey(finalTierId);
    const containerEntries = byContainer.get(containerKey) ?? [];
    const overId = String(over.id);
    if (overId.startsWith(CONTAINER_PREFIX)) return;

    const overEntryId = Number(overId);
    const oldIndex = containerEntries.findIndex(e => e.id === draggedId);
    const newIndex = containerEntries.findIndex(e => e.id === overEntryId);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    const reordered = arrayMove(containerEntries, oldIndex, newIndex);
    dispatch({
      type: 'REORDER_TIER_CONTENTS',
      tierKey: fromContainerKey(containerKey),
      orderedIds: reordered.map(e => e.id),
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      measuring={MEASURING_CONFIG}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <UnrankedPool entries={byContainer.get('pool') ?? []} onDelete={handleDelete} onShuffle={handleShuffle} />

      <div className={styles.tiers}>
        {state.tiers.map((tier, index) => (
          <TierRow
            key={tier.id}
            tier={tier}
            entries={byContainer.get(tier.id) ?? []}
            onRename={label => dispatch({ type: 'RENAME_TIER', tierId: tier.id, label })}
            onDelete={handleDelete}
            onRemoveTier={() => handleRemoveTier(tier.id)}
            onRecolor={color => handleRecolorTier(tier.id, color)}
            onMoveUp={() => handleMoveTier(tier.id, 'up')}
            onMoveDown={() => handleMoveTier(tier.id, 'down')}
            canRemoveTier={!nonEmptyTierIds.has(tier.id)}
            canMoveUp={index > 0}
            canMoveDown={index < state.tiers.length - 1}
          />
        ))}
        <button type="button" className={styles.addTierBtn} onClick={handleAddTier}>
          + Add Tier
        </button>
      </div>

      {/*
        Without this, a dragged card is only ever a CSS transform on its
        original DOM node (see SortableEntry), which stays trapped in its
        origin container's flex layout and stacking context — crossing into
        a different tier row then renders it behind other cards and it never
        visually "snaps" to the pointer. DragOverlay portals the dragged card
        to document.body instead, independent of any container's layout.
      */}
      <DragOverlay>{activeEntry && <EntryCard entry={activeEntry} isDragging onDelete={handleDelete} />}</DragOverlay>
    </DndContext>
  );
}
