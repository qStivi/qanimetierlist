import { useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useTierList } from '../../context/useTierList';
import { TierRow } from '../TierRow';
import { UnrankedPool } from '../UnrankedPool';
import { CONTAINER_PREFIX, toContainerKey, fromContainerKey } from '../../utils/containerIds';
import styles from './TierList.module.css';

export function TierList() {
  const { state, dispatch } = useTierList();
  const [dragOverride, setDragOverride] = useState<Record<number, string | null> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const characters = state.characters;
  const tiers = state.tiers;
  const assignments = state.assignments;

  const effectiveAssignments = useMemo(
    () => (dragOverride ? { ...assignments, ...dragOverride } : assignments),
    [assignments, dragOverride]
  );

  const byContainer = useMemo(() => {
    const map = new Map<string, typeof characters>();
    map.set('pool', []);
    for (const tier of tiers) map.set(tier.id, []);
    for (const c of characters) {
      const key = toContainerKey(effectiveAssignments[c.id] ?? null);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return map;
  }, [characters, tiers, effectiveAssignments]);

  function resolveContainerKey(id: string): string {
    if (id.startsWith(CONTAINER_PREFIX)) return id.slice(CONTAINER_PREFIX.length);
    const charId = Number(id);
    return toContainerKey(effectiveAssignments[charId] ?? null);
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
    const activeId = Number(active.id);
    const finalOverride = dragOverride;
    setDragOverride(null);

    const finalTierId = finalOverride && activeId in finalOverride
      ? finalOverride[activeId]
      : state.assignments[activeId] ?? null;

    if ((state.assignments[activeId] ?? null) !== finalTierId) {
      dispatch({ type: 'MOVE_CHARACTER', characterId: activeId, tierId: finalTierId });
    }

    if (!over) return;

    const containerKey = toContainerKey(finalTierId);
    const containerChars = byContainer.get(containerKey) ?? [];
    const overId = String(over.id);
    if (overId.startsWith(CONTAINER_PREFIX)) return;

    const overCharId = Number(overId);
    const oldIndex = containerChars.findIndex(c => c.id === activeId);
    const newIndex = containerChars.findIndex(c => c.id === overCharId);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    const reordered = arrayMove(containerChars, oldIndex, newIndex);
    dispatch({
      type: 'REORDER_TIER_CONTENTS',
      tierKey: fromContainerKey(containerKey),
      orderedIds: reordered.map(c => c.id),
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <UnrankedPool characters={byContainer.get('pool') ?? []} />

      <div className={styles.tiers}>
        {state.tiers.map(tier => (
          <TierRow
            key={tier.id}
            tier={tier}
            characters={byContainer.get(tier.id) ?? []}
            onRename={label => dispatch({ type: 'RENAME_TIER', tierId: tier.id, label })}
          />
        ))}
      </div>
    </DndContext>
  );
}
